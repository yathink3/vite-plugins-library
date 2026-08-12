import type { Plugin } from 'vite';
import autoAliasPlugin from './autoAlias';

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
 * Vite plugin to configure custom path aliases (e.g. `{ '@': '/src' }`) and deduplicate React core dependencies.
 *
 * @deprecated Prefer using `autoAliasPlugin` (`vite-plugins-library/auto-alias`) for automated tsconfig and folder aliasing.
 * @param options - Configuration options for path aliases and package deduplication.
 * @returns A Vite Plugin object.
 */
export default function customConfigPlugin(options: CustomConfigOptions = {}): Plugin {
  const symbol = options.aliasSymbol || '@';
  const targetDirName = options.aliasTargetDir || 'src';

  const extraDedupe = options.dedupePackages || [];
  const dedupe = Array.from(new Set([...DEFAULT_DEDUPE, ...extraDedupe]));

  const customAliases = options.alias || { [symbol]: targetDirName };

  const autoAlias = autoAliasPlugin({
    prefix: symbol,
    srcDir: targetDirName,
    customAliases,
    dedupePackages: dedupe,
    autoMapSrcFolders: true,
  });

  return {
    ...autoAlias,
    name: 'vite-plugin-custom-config',
  };
}
