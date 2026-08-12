import path from 'path';
import type { Plugin } from 'vite';

/**
 * Options for the customConfigPlugin.
 */
export interface CustomConfigOptions {
  /**
   * Key-value map of path aliases to directory paths (e.g. `{ '@': '/src', '~': '/src/components' }`).
   */
  alias?: Record<string, string>;
  /**
   * The path alias symbol to replace in import statements.
   * @default '@'
   */
  aliasSymbol?: string;
  /**
   * Target directory name relative to project root that the alias resolves to.
   * @default 'src'
   */
  aliasTargetDir?: string;
  /**
   * Additional list of module names to deduplicate during module resolution.
   */
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
 * Vite plugin to configure custom path aliases (e.g. `{ '@': '/src' }` or `@` -> `src`) and deduplicate React core dependencies.
 *
 * @param options - Configuration options for path aliases and package deduplication.
 * @returns A Vite Plugin object.
 */
export default function customConfigPlugin(options: CustomConfigOptions = {}): Plugin {
  const symbol = options.aliasSymbol || '@';
  const targetDirName = options.aliasTargetDir || 'src';

  const extraDedupe = options.dedupePackages || [];
  const dedupe = Array.from(new Set([...DEFAULT_DEDUPE, ...extraDedupe]));

  return {
    name: 'vite-plugin-custom-config',
    config(config) {
      const root = config.root || process.cwd();
      config.resolve = config.resolve || {};
      config.resolve.dedupe = [
        ...(config.resolve.dedupe || []),
        ...dedupe,
      ];

      // Build aliases map
      const aliasesToSet: Record<string, string> = {};
      if (options.alias && typeof options.alias === 'object') {
        for (const [findKey, targetPath] of Object.entries(options.alias)) {
          const cleanTarget = targetPath.startsWith('/') ? targetPath.slice(1) : targetPath;
          aliasesToSet[findKey] = path.resolve(root, cleanTarget);
        }
      } else {
        const cleanTarget = targetDirName.startsWith('/') ? targetDirName.slice(1) : targetDirName;
        aliasesToSet[symbol] = path.resolve(root, cleanTarget);
      }

      const currentAlias = config.resolve.alias || {};
      if (Array.isArray(currentAlias)) {
        for (const [find, replacement] of Object.entries(aliasesToSet)) {
          currentAlias.push({ find, replacement });
        }
      } else {
        config.resolve.alias = {
          ...currentAlias,
          ...aliasesToSet,
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
