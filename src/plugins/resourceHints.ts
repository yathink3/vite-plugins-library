import type { Plugin } from 'vite';

export interface ResourceHintsOptions {
  /**
   * Inject `<link rel="modulepreload">` for entry JS module chunks.
   * @default true
   */
  modulePreload?: boolean;
  /**
   * Inject `<link rel="preload" as="style">` for CSS assets.
   * @default true
   */
  preloadCss?: boolean;
  /**
   * Inject `<link rel="preload" as="font" crossorigin="anonymous">` for web fonts (.woff2, .woff, .ttf).
   * @default true
   */
  preloadFonts?: boolean;
  /**
   * Domains to preconnect (e.g., `['https://fonts.googleapis.com', 'https://api.example.com']`).
   */
  preconnect?: string[];
  /**
   * Domains to DNS prefetch (e.g., `['https://cdn.example.com']`).
   */
  dnsPrefetch?: string[];
  /**
   * Optional file pattern to include.
   */
  include?: RegExp | string | Array<RegExp | string>;
  /**
   * Optional file pattern to exclude.
   */
  exclude?: RegExp | string | Array<RegExp | string>;
}

function matchesPattern(filename: string, pattern?: RegExp | string | Array<RegExp | string>): boolean {
  if (!pattern) return false;
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  return patterns.some((p) => {
    if (typeof p === 'string') return filename.endsWith(p) || filename.includes(p);
    return p.test(filename);
  });
}

function getFontType(fileName: string): string {
  if (fileName.endsWith('.woff2')) return 'type="font/woff2"';
  if (fileName.endsWith('.woff')) return 'type="font/woff"';
  if (fileName.endsWith('.ttf')) return 'type="font/ttf"';
  if (fileName.endsWith('.otf')) return 'type="font/otf"';
  return '';
}

/**
 * Vite plugin to automatically inject resource hints (`<link rel="modulepreload">`, font preloads, CSS preloads,
 * `preconnect`, and `dns-prefetch`) into HTML for Core Web Vitals (LCP/FID) optimization.
 *
 * @param options Configuration options for preloading chunks, fonts, CSS, and external domains.
 * @returns Vite Plugin instance.
 */
export default function resourceHintsPlugin(options: ResourceHintsOptions = {}): Plugin {
  const isModulePreloadEnabled = options.modulePreload !== false;
  const isPreloadCssEnabled = options.preloadCss !== false;
  const isPreloadFontsEnabled = options.preloadFonts !== false;

  return {
    name: 'vite-plugin-resource-hints',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const links: string[] = [];

        // 1. External preconnect domains
        if (options.preconnect) {
          for (const domain of options.preconnect) {
            links.push(`    <link rel="preconnect" href="${domain}" crossorigin />`);
          }
        }

        // 2. External DNS prefetch domains
        if (options.dnsPrefetch) {
          for (const domain of options.dnsPrefetch) {
            links.push(`    <link rel="dns-prefetch" href="${domain}" />`);
          }
        }

        // 3. Rollup Bundle asset preloads
        if (ctx.bundle) {
          const publicPath = (ctx.server?.config.base || '/').replace(/\/$/, '') + '/';

          for (const [fileName, fileMeta] of Object.entries(ctx.bundle)) {
            if (options.exclude && matchesPattern(fileName, options.exclude)) continue;
            if (options.include && !matchesPattern(fileName, options.include)) continue;

            const fileUrl = `${publicPath}${fileName}`;

            // Fonts
            if (isPreloadFontsEnabled && /\.(woff2?|ttf|otf)$/i.test(fileName)) {
              const mime = getFontType(fileName);
              links.push(`    <link rel="preload" href="${fileUrl}" as="font" ${mime} crossorigin="anonymous" />`);
            }

            // CSS
            if (isPreloadCssEnabled && fileName.endsWith('.css')) {
              links.push(`    <link rel="preload" href="${fileUrl}" as="style" />`);
            }

            // JS Entry Chunks
            if (isModulePreloadEnabled && fileMeta.type === 'chunk' && fileMeta.isEntry) {
              links.push(`    <link rel="modulepreload" href="${fileUrl}" />`);
            }
          }
        }

        if (links.length === 0) return html;

        const injectedContent = links.join('\n');
        if (html.includes('</head>')) {
          return html.replace('</head>', `${injectedContent}\n  </head>`);
        }

        return `${injectedContent}\n${html}`;
      },
    },
  };
}
