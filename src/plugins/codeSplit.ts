import type { Plugin } from 'vite';

export interface CodeSplitGroup {
  /**
   * Output chunk name for matched modules.
   */
  name: string;
  /**
   * Regular expression pattern, string substring, or test function to match module IDs.
   */
  test: RegExp | string | ((id: string) => boolean);
}

/**
 * Options for the codeSplitPlugin / advancedChunksConfigPlugin.
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
  /**
   * Custom code splitting groups passed as prop to group node_modules or source modules into specific named chunks.
   */
  groups?: CodeSplitGroup[];
  /**
   * Optional codeSplitting object structure ({ groups: CodeSplitGroup[] }).
   */
  codeSplitting?: { groups?: CodeSplitGroup[] } | any;
}

const DEFAULT_SAFE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif',
  'ttf', 'woff', 'eot', 'woff2', 'xlsx'
]);

function isGroupMatch(id: string, test: RegExp | string | ((id: string) => boolean)): boolean {
  if (typeof test === 'function') return test(id);
  if (typeof test === 'string') return id.includes(test);
  return test.test(id);
}

/**
 * Vite plugin for structured Rollup & Rolldown output chunk naming (`jsDir`, `cssDir`, `assetDir`)
 * with customizable code splitting groups passed via props (`options.groups`).
 *
 * @param options - Configuration options for directory names, asset extensions, and code splitting groups prop.
 * @returns A Vite Plugin object.
 */
export default function codeSplitPlugin(options: CodeSplitPluginOptions = {}): Plugin {
  const jsDir = (options.jsDir || 'j').replace(/\/+$/, '');
  const cssDir = (options.cssDir || 'c').replace(/\/+$/, '');
  const assetDir = (options.assetDir || 'a').replace(/\/+$/, '');

  const safeExts = options.safeExtensions ? new Set(options.safeExtensions) : DEFAULT_SAFE_EXTS;
  const maxAssetLen = options.maxAssetChunkNameLength ?? 25;
  const maxJsLen = options.maxJsChunkNameLength ?? 20;

  const groups: CodeSplitGroup[] = options.groups || options.codeSplitting?.groups || [];

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

  const sharedManualChunks = (id: string) => {
    for (const group of groups) {
      if (isGroupMatch(id, group.test)) {
        return group.name;
      }
    }
    return undefined;
  };

  const sharedCodeSplitting = {
    groups,
  };

  return {
    name: 'vite-plugin-code-split',
    apply: 'build',
    config(config) {
      config.build = config.build || {};
      const buildConfig = config.build as any;

      // 1. Rollup Options configuration
      buildConfig.rollupOptions = buildConfig.rollupOptions || {};
      const rollupOutput = buildConfig.rollupOptions.output;

      const applyRollupOutputs = (outputObj: any) => {
        if (!outputObj.assetFileNames) outputObj.assetFileNames = sharedAssetFileNames;
        if (!outputObj.chunkFileNames) outputObj.chunkFileNames = sharedChunkFileNames;
        if (groups.length > 0 && !outputObj.manualChunks) {
          outputObj.manualChunks = sharedManualChunks;
        }
      };

      if (!rollupOutput) {
        buildConfig.rollupOptions.output = {
          assetFileNames: sharedAssetFileNames,
          chunkFileNames: sharedChunkFileNames,
          ...(groups.length > 0 ? { manualChunks: sharedManualChunks } : {}),
        };
      } else if (Array.isArray(rollupOutput)) {
        rollupOutput.forEach(applyRollupOutputs);
      } else {
        applyRollupOutputs(rollupOutput);
      }

      // 2. Rolldown Options configuration (Vite 6+)
      buildConfig.rolldownOptions = buildConfig.rolldownOptions || {};
      const rolldownOutput = buildConfig.rolldownOptions.output;

      const applyRolldownOutputs = (outputObj: any) => {
        outputObj.assetFileNames = sharedAssetFileNames;
        outputObj.chunkFileNames = sharedChunkFileNames;
        if (groups.length > 0) {
          outputObj.codeSplitting = sharedCodeSplitting;
          delete outputObj.manualChunks;
        }
      };

      if (!rolldownOutput) {
        buildConfig.rolldownOptions.output = {
          assetFileNames: sharedAssetFileNames,
          chunkFileNames: sharedChunkFileNames,
          ...(groups.length > 0 ? { codeSplitting: sharedCodeSplitting } : {}),
        };
      } else if (Array.isArray(rolldownOutput)) {
        rolldownOutput.forEach(applyRolldownOutputs);
      } else {
        applyRolldownOutputs(rolldownOutput);
      }
    },
    configResolved(config) {
      const buildConfig = config.build as any;
      if (buildConfig?.rolldownOptions?.output) {
        const outputs = Array.isArray(buildConfig.rolldownOptions.output)
          ? buildConfig.rolldownOptions.output
          : [buildConfig.rolldownOptions.output];
        for (const out of outputs) {
          if (out && out.codeSplitting) {
            delete out.manualChunks;
          }
        }
      }
    },
  };
}
