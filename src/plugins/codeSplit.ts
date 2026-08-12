import type { Plugin } from 'vite';

export interface CodeSplitPluginOptions {
  safeExtensions?: string[];
  maxAssetChunkNameLength?: number;
  maxJsChunkNameLength?: number;
}

const DEFAULT_SAFE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif',
  'ttf', 'woff', 'eot', 'woff2', 'xlsx'
]);

export default function codeSplitPlugin(options: CodeSplitPluginOptions = {}): Plugin {
  const safeExts = options.safeExtensions ? new Set(options.safeExtensions) : DEFAULT_SAFE_EXTS;
  const maxAssetLen = options.maxAssetChunkNameLength ?? 25;
  const maxJsLen = options.maxJsChunkNameLength ?? 20;

  const sharedAssetFileNames = (assetInfo: { names?: string[] }) => {
    const fileName = assetInfo.names?.[0] || '';
    if (!fileName) return 'a/[hash][extname]';
    const dotIndex = fileName.lastIndexOf('.');
    const name = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
    const ext = dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : '';

    if (safeExts.has(ext)) {
      if (!name) return 'a/[hash][extname]';
      const chunkName = name.slice(0, maxAssetLen).toLowerCase();
      return `a/${chunkName}[extname]`;
    }
    if (ext === 'css') {
      if (!name) return 'c/[hash][extname]';
      const chunkName = name.slice(0, maxJsLen).toLowerCase();
      return `c/${chunkName}-[hash][extname]`;
    }
    return 'a/[hash][extname]';
  };

  const sharedChunkFileNames = (chunkInfo: { name?: string }) => {
    const name = chunkInfo.name;
    if (!name) return 'j/[hash].js';
    const chunkName = name.slice(0, maxJsLen).toLowerCase();
    return `j/${chunkName}-[hash].js`;
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
