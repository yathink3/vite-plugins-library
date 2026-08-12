import type { Plugin } from 'vite';
import envValidatorPlugin from './envValidator';

/**
 * Options for the envLoaderPlugin.
 */
export interface EnvLoaderOptions {
  /**
   * Environment variable key prefixes to match and expose (e.g. `['VITE_', 'BASE_']`).
   * @default ['BASE_']
   */
  prefixes?: string[];
  /**
   * Directory path containing `.env` files. Defaults to project root.
   */
  envDir?: string;
}

/**
 * Vite plugin to load environment variables from `.env` files matching specific prefixes and expose them on `process.env.*`.
 *
 * @deprecated Prefer using `envValidatorPlugin` (`vite-plugins-library/env-validator`) with `injectToProcessEnv: true` for unified env loading & schema validation.
 * @param prefixesOrOptions - Array of variable prefixes or an `EnvLoaderOptions` configuration object.
 * @returns A Vite Plugin object.
 */
export default function envLoaderPlugin(prefixesOrOptions: string[] | EnvLoaderOptions = ['BASE_']): Plugin {
  let prefixes: string[] = ['BASE_'];
  let envDir: string | undefined;

  if (Array.isArray(prefixesOrOptions)) {
    prefixes = prefixesOrOptions;
  } else if (prefixesOrOptions && typeof prefixesOrOptions === 'object') {
    prefixes = prefixesOrOptions.prefixes || ['BASE_'];
    envDir = prefixesOrOptions.envDir;
  }

  const validator = envValidatorPlugin({
    prefixes,
    envDir,
    injectToProcessEnv: true,
  });

  return {
    ...validator,
    name: 'vite-plugin-env-loader',
  };
}
