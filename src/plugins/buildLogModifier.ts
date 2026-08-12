import type { Plugin } from 'vite';

/**
 * Options for the buildLogModifierPlugin.
 */
export interface BuildLogModifierOptions {
  /**
   * Array of build warning codes to suppress from terminal output.
   * @default ['EVAL', 'EMPTY_IMPORT_META']
   */
  ignoredCodes?: string[];
  /**
   * Alias for `ignoredCodes`.
   */
  suppressCodes?: string[];
  /**
   * Array of plugin names whose warnings should be suppressed from terminal output.
   * @default ['builtin:vite-reporter']
   */
  ignoredPlugins?: string[];
  /**
   * Alias for `ignoredPlugins`.
   */
  suppressPlugins?: string[];
}

const DEFAULT_IGNORED_CODES = ['EVAL', 'EMPTY_IMPORT_META'];
const DEFAULT_IGNORED_PLUGINS = ['builtin:vite-reporter'];

/**
 * Vite plugin to filter and suppress specific build warning codes and plugin log messages from build logs.
 *
 * @param options - Configuration options for ignored log codes and plugins.
 * @returns A Vite Plugin object.
 */
export default function buildLogModifierPlugin(options: BuildLogModifierOptions = {}): Plugin {
  const codesList = options.suppressCodes || options.ignoredCodes || DEFAULT_IGNORED_CODES;
  const pluginsList = options.suppressPlugins || options.ignoredPlugins || DEFAULT_IGNORED_PLUGINS;

  const ignoredCodes = new Set(codesList);
  const ignoredPlugins = new Set(pluginsList);

  return {
    name: 'vite-plugin-build-log-modifier',
    apply: 'build',
    config(config) {
      config.build = config.build || {};
      const buildConfig = config.build as any;
      buildConfig.rolldownOptions = buildConfig.rolldownOptions || {};

      buildConfig.rolldownOptions.onLog = (level: string, log: any, defaultHandler: Function) => {
        if (level === 'warn') {
          if (log.code && ignoredCodes.has(log.code)) return;
          if (log.plugin && ignoredPlugins.has(log.plugin)) return;
        }
        defaultHandler(level, log);
      };
    },
  };
}
