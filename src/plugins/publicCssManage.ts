import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger, preprocessCSS, type Plugin, type ResolvedConfig } from 'vite';
import { logStep } from '../utils/logger';

/**
 * Options for the publicCssManagePlugin.
 */
export interface PublicCssManageOptions {
  /**
   * List of folder names inside the public directory containing CSS assets to manage and optimize.
   * @default ['css']
   */
  folders?: string[];
  /**
   * Whether to minify public CSS assets during production builds.
   * @default true
   */
  minifyInProduction?: boolean;
  /**
   * Target HTML file name relative to output directory for public CSS optimization.
   * @default 'index.html'
   */
  targetHtml?: string;
}

/**
 * Combined Vite plugin to manage public CSS asset path rewrites in development mode and optimize/minify public CSS files during production builds.
 *
 * @param options - Configuration options object or an array of public directory folder names.
 * @returns A Vite Plugin object.
 */
export default function publicCssManagePlugin(options: PublicCssManageOptions | string[] = {}): Plugin {
  const folders = Array.isArray(options)
    ? options
    : options.folders || ['css'];

  const shouldMinify = Array.isArray(options) ? true : options.minifyInProduction !== false;
  const targetHtml = Array.isArray(options) ? 'index.html' : options.targetHtml || 'index.html';

  if (!Array.isArray(folders) || folders.some(f => typeof f !== 'string')) {
    throw new Error('The "folders" option must be an array of strings.');
  }

  let isDevMode = false;
  let patternMatched = false;
  let viteConfig: ResolvedConfig | undefined;
  const escapedFolders = folders.map(f => f.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  const assetPattern = new RegExp(`(href|src)="\\/(${escapedFolders})\\/(?![^"]+\\.min\\.css)([^"]+)"`, 'g');

  return {
    name: 'vite-plugin-public-css-manage',
    apply: () => true,
    config(_config, { command }) {
      isDevMode = command === 'serve';
      if (isDevMode) {
        const logger = createLogger();
        const originalWarn = logger.warn;
        logger.warn = (msg, options) => {
          if (patternMatched && msg.includes('Files in the public directory are served at the root path')) return;
          originalWarn(msg, options);
        };
        return { customLogger: logger };
      }
    },
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },
    transformIndexHtml(html) {
      if (!isDevMode || (viteConfig as any)?.experimental?.bundledDev) return html;
      const transformedHtml = html.replace(assetPattern, '$1="public/$2/$3"');
      if (transformedHtml !== html) patternMatched = true;
      return transformedHtml;
    },
    async closeBundle() {
      if (isDevMode || !shouldMinify || !viteConfig) return;
      const outDir = viteConfig.build.outDir || 'dist';
      const indexPath = resolve(outDir, targetHtml);
      const configWithCss = {
        ...viteConfig,
        css: {
          ...viteConfig.css,
          minify: true,
        },
      } as ResolvedConfig;

      if (!existsSync(indexPath)) {
        return;
      }

      try {
        const htmlContent = readFileSync(indexPath, 'utf-8');
        const matchedResult = htmlContent.match(assetPattern);
        if (!matchedResult) return;
        const fileExtractionRegex = new RegExp(`(${escapedFolders})\\/[^"]+`);
        const filesToOptimize = matchedResult
          .map(str => {
            const match = str.match(fileExtractionRegex);
            return match ? match[0] : null;
          })
          .filter(file => file && file.endsWith('.css')) as string[];

        await Promise.all(
          filesToOptimize.map(async file => {
            const filePath = resolve(outDir, file);
            try {
              if (!existsSync(filePath)) return;
              const code = readFileSync(filePath, 'utf-8');
              const { code: optimizedCss } = await preprocessCSS(code, filePath, configWithCss);
              if (optimizedCss) {
                writeFileSync(filePath, optimizedCss);
                logStep('public-css', '[SUCCESS]', `Optimized public CSS: ${outDir}/${file}`);
              }
            } catch (e) {
              logStep('public-css', '[WARNING]', `Could not optimize ${outDir}/${file}: ${(e as Error).message}`);
            }
          })
        );
      } catch (error) {
        logStep('public-css', '[ERROR]', `Error parsing index.html for CSS optimization: ${(error as Error).message}`);
      }
    },
  };
}
