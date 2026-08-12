import path from 'path';
import type { Plugin } from 'vite';

export interface CustomConfigOptions {
  aliasSymbol?: string;
  aliasTargetDir?: string;
  dedupePackages?: string[];
}

const DEFAULT_DEDUPE = [
  'react',
  'react-dom',
  'react-redux',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
];

/**
 * Plugin to add custom aliases and package deduplication rules to Vite config.
 */
export default function customConfigPlugin(options: CustomConfigOptions = {}): Plugin {
  const symbol = options.aliasSymbol || '@';
  const targetDirName = options.aliasTargetDir || 'src';
  const dedupe = options.dedupePackages || DEFAULT_DEDUPE;

  return {
    name: 'vite-plugin-custom-config',
    config(config) {
      const root = config.root || process.cwd();
      config.resolve = config.resolve || {};
      config.resolve.dedupe = [
        ...(config.resolve.dedupe || []),
        ...dedupe,
      ];

      const currentAlias = config.resolve.alias || {};
      if (Array.isArray(currentAlias)) {
        currentAlias.push({
          find: symbol,
          replacement: path.resolve(root, targetDirName),
        });
      } else {
        config.resolve.alias = {
          ...currentAlias,
          [symbol]: path.resolve(root, targetDirName),
        };
      }

      const configAny = config as any;
      configAny.legacy = configAny.legacy || {};
      configAny.legacy.inconsistentCjsInterop = true;

      config.optimizeDeps = config.optimizeDeps || {};
      config.optimizeDeps.exclude = [...(config.optimizeDeps.exclude || []), 'jsx-runtime'];
    },
  };
}
