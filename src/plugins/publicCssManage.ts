import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger, preprocessCSS, type Plugin, type ResolvedConfig } from 'vite';

export interface PublicCssManageOptions {
  folders?: string[];
  minifyInProduction?: boolean;
}

/**
 * Combined plugin to manage public assets rewrites in dev mode
 * and optimization/minification during production builds.
 */
export default function publicCssManagePlugin(options: PublicCssManageOptions | string[] = {}): Plugin {
  const folders = Array.isArray(options)
    ? options
    : options.folders || ['css'];

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
      if (isDevMode || !viteConfig) return;
      const outDir = viteConfig.build.outDir || 'dist';
      const indexPath = resolve(outDir, 'index.html');
      const configWithCss = {
        ...viteConfig,
        css: {
          ...viteConfig.css,
          transformer: 'lightningcss' as const,
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
                console.log(`✨ Vite Optimized Public CSS: ${outDir}/${file}`);
              }
            } catch (e) {
              console.warn(`Could not optimize ${outDir}/${file}: ${(e as Error).message}`);
            }
          })
        );
      } catch (error) {
        console.error(`❌ Error parsing index.html for CSS optimization: ${(error as Error).message}`);
      }
    },
  };
}
