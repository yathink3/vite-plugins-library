import type { Plugin } from 'vite';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { logStep } from '../utils/logger';

/**
 * Options for the fontLocalizerPlugin.
 */
export interface FontLocalizerOptions {
  /**
   * Directory relative to output dist/public directory where downloaded woff2 fonts will be stored.
   * @default 'fonts'
   */
  outputDir?: string;
  /**
   * Whether to inject self-hosted `@font-face` CSS directly into `index.html` `<head>`.
   * @default true
   */
  inlineCss?: boolean;
  /**
   * Enable or disable Google Font localization.
   * @default true
   */
  enabled?: boolean;
}

const MODERN_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetches string content from an HTTP/HTTPS URL.
 */
function fetchUrl(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, { headers: { 'User-Agent': MODERN_USER_AGENT, ...headers } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location, headers).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

/**
 * Downloads a binary file buffer from an HTTP/HTTPS URL.
 */
function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, { headers: { 'User-Agent': MODERN_USER_AGENT } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadBuffer(res.headers.location).then(resolve).catch(reject);
        }
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/**
 * Vite plugin that intercepts Google Fonts links in `index.html`, automatically downloads `.woff2` font files
 * to local build assets, and rewrites HTML to serve privacy-compliant, zero-latency self-hosted web fonts.
 *
 * @param options - Configuration options for font asset directory and CSS inlining.
 * @returns A Vite Plugin object.
 */
export default function fontLocalizerPlugin(options: FontLocalizerOptions = {}): Plugin {
  const outputDir = (options.outputDir || 'fonts').replace(/^\/+|\/+$/g, '');
  const inlineCss = options.inlineCss !== false;
  const enabled = options.enabled !== false;

  return {
    name: 'vite-plugin-font-localizer',
    enforce: 'pre',
    async transformIndexHtml(html, ctx) {
      if (!enabled) return html;

      // Match Google Fonts CSS link tags
      const googleFontLinkRegex = /<link[^>]+href=["'](https?:\/\/fonts\.googleapis\.com\/css2?[^"']+)["'][^>]*>/gi;
      const matches = Array.from(html.matchAll(googleFontLinkRegex));

      if (matches.length === 0) {
        return html;
      }

      logStep('fonts', `Found ${matches.length} Google Font link(s) in index.html to localize`);

      let updatedHtml = html;

      for (const match of matches) {
        const fullLinkTag = match[0];
        const fontCssUrl = match[1];

        try {
          // 1. Fetch font CSS from Google Fonts CDN
          const rawCss = await fetchUrl(fontCssUrl);

          // 2. Extract binary font URLs (.woff2)
          const fontUrlRegex = /url\((https?:\/\/fonts\.gstatic\.com\/[^)]+)\)/gi;
          const fontUrlMatches = Array.from(rawCss.matchAll(fontUrlRegex));

          let localizedCss = rawCss;
          const downloadedFonts: Array<{ filename: string; buffer: Buffer }> = [];

          for (let i = 0; i < fontUrlMatches.length; i++) {
            const fontRemoteUrl = fontUrlMatches[i][1];
            const extMatch = fontRemoteUrl.match(/\.(woff2|woff|ttf|eot)(\?.*)?$/i);
            const ext = extMatch ? extMatch[1] : 'woff2';
            const localFileName = `font-${i + 1}-${Date.now().toString(36)}.${ext}`;

            try {
              const fontBuffer = await downloadBuffer(fontRemoteUrl);
              downloadedFonts.push({ filename: localFileName, buffer: fontBuffer });

              // Replace remote URL with local path in CSS
              const localUrl = `/${outputDir}/${localFileName}`;
              localizedCss = localizedCss.replace(fontRemoteUrl, localUrl);
            } catch (err: any) {
              logStep('fonts', '[WARNING]', `Failed to download font ${fontRemoteUrl}: ${err.message}`);
            }
          }

          // 3. Emit downloaded font assets into build
          if (ctx && ctx.bundle && typeof (this as any)?.emitFile === 'function') {
            for (const font of downloadedFonts) {
              (this as any).emitFile({
                type: 'asset',
                fileName: `${outputDir}/${font.filename}`,
                source: font.buffer,
              });
            }
          } else {
            // Write to public folder in dev mode if public folder exists
            const publicFontDir = path.resolve(process.cwd(), 'public', outputDir);
            if (!fs.existsSync(publicFontDir)) {
              fs.mkdirSync(publicFontDir, { recursive: true });
            }
            for (const font of downloadedFonts) {
              fs.writeFileSync(path.join(publicFontDir, font.filename), font.buffer);
            }
          }

          // 4. Update index.html
          if (inlineCss) {
            const fontStyleTag = `<style id="localized-fonts">\n${localizedCss}\n</style>`;
            updatedHtml = updatedHtml.replace(fullLinkTag, fontStyleTag);
          } else {
            // Clean google font links
            updatedHtml = updatedHtml.replace(fullLinkTag, '');
          }

          logStep('fonts', '[SUCCESS]', `Successfully localized fonts into /${outputDir}/`);
        } catch (err: any) {
          logStep('fonts', '[ERROR]', `Failed to process Google Font URL ${fontCssUrl}: ${err.message}`);
        }
      }

      // Also clean up any extra Google Fonts preconnect links
      updatedHtml = updatedHtml.replace(/<link[^>]+href=["']https?:\/\/fonts\.gstatic\.com["'][^>]*>/gi, '');

      return updatedHtml;
    },
  };
}
