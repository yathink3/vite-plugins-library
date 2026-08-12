import type { Plugin } from 'vite';

/**
 * Options for the codeSplitPlugin.
 */
export interface CodeSplitPluginOptions {
  /**
   * Output directory name for JavaScript chunks.
   * @default 'j'
   */
  jsDir?: string;
  /**
   * Output directory name for CSS chunks.
   * @default 'c'
   */
  cssDir?: string;
  /**
   * Output directory name for static asset files.
   * @default 'a'
   */
  assetDir?: string;
  /**
   * File extensions recognized as static assets to be moved into the asset directory.
   * @default ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif', 'ttf', 'woff', 'eot', 'woff2', 'xlsx']
   */
  safeExtensions?: string[];
  /**
   * Maximum character length for asset chunk names.
   * @default 25
   */
  maxAssetChunkNameLength?: number;
  /**
   * Maximum character length for JS and CSS chunk names.
   * @default 20
   */
  maxJsChunkNameLength?: number;
}

const DEFAULT_SAFE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif',
  'ttf', 'woff', 'eot', 'woff2', 'xlsx'
]);

/**
 * Vite plugin for structured Rollup output chunk naming into dedicated subdirectories (`jsDir` for JS, `cssDir` for CSS, `assetDir` for static assets).
 *
 * @param options - Configuration options for output directory names, asset extensions, and chunk name lengths.
 * @returns A Vite Plugin object.
 */
export default function codeSplitPlugin(options: CodeSplitPluginOptions = {}): Plugin {
  const jsDir = (options.jsDir || 'j').replace(/\/+$/, '');
  const cssDir = (options.cssDir || 'c').replace(/\/+$/, '');
  const assetDir = (options.assetDir || 'a').replace(/\/+$/, '');

  const safeExts = options.safeExtensions ? new Set(options.safeExtensions) : DEFAULT_SAFE_EXTS;
  const maxAssetLen = options.maxAssetChunkNameLength ?? 25;
  const maxJsLen = options.maxJsChunkNameLength ?? 20;

  const sharedAssetFileNames = (assetInfo: { names?: string[] }) => {
    const fileName = assetInfo.names?.[0] || '';
    if (!fileName) return `${assetDir}/[hash][extname]`;
    const dotIndex = fileName.lastIndexOf('.');
    const name = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
    const ext = dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : '';

    if (safeExts.has(ext)) {
      if (!name) return `${assetDir}/[hash][extname]`;
      const chunkName = name.slice(0, maxAssetLen).toLowerCase();
      return `${assetDir}/${chunkName}[extname]`;
    }
    if (ext === 'css') {
      if (!name) return `${cssDir}/[hash][extname]`;
      const chunkName = name.slice(0, maxJsLen).toLowerCase();
      return `${cssDir}/${chunkName}-[hash][extname]`;
    }
    return `${assetDir}/[hash][extname]`;
  };

  const sharedChunkFileNames = (chunkInfo: { name?: string }) => {
    const name = chunkInfo.name;
    if (!name) return `${jsDir}/[hash].js`;
    const chunkName = name.slice(0, maxJsLen).toLowerCase();
    return `${jsDir}/${chunkName}-[hash].js`;
  };

  return {
    name: 'vite-plugin-code-split',
    apply: 'build',
    config(config) {
      config.build = config.build || {};
      const buildConfig = config.build as any;
      buildConfig.rolldownOptions = buildConfig.rolldownOptions || {};

      const output = buildConfig.rolldownOptions.output;

      if (!output) {
        buildConfig.rolldownOptions.output = {
          assetFileNames: sharedAssetFileNames,
          chunkFileNames: sharedChunkFileNames,
        };
      } else if (Array.isArray(output)) {
        output.forEach((outputObj: any) => {
          outputObj.assetFileNames = sharedAssetFileNames;
          outputObj.chunkFileNames = sharedChunkFileNames;
        });
      } else {
        output.assetFileNames = sharedAssetFileNames;
        output.chunkFileNames = sharedChunkFileNames;
      }
    },
  };
}
