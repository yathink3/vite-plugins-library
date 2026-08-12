import { loadEnv, type Plugin } from 'vite';

export interface EnvLoaderOptions {
  prefixes?: string[];
  envDir?: string;
}

/**
 * Vite Plugin to load environment variables from .env files and expose them as process.env.*
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

  return {
    name: 'vite-plugin-env-loader',
    config(config, { mode }) {
      const targetDir = envDir || config.envDir || process.cwd();
      const env = loadEnv(mode, targetDir, prefixes);
      const define = (config.define = config.define || {});
      for (const [key, value] of Object.entries(env)) {
        define[`process.env.${key}`] = JSON.stringify(value);
      }
    },
  };
}
