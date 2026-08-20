import type { Plugin, LogOptions, LogErrorOptions } from 'vite';

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
  const codesList = [...DEFAULT_IGNORED_CODES, ...(options.suppressCodes || options.ignoredCodes || [])];
  const pluginsList = [...DEFAULT_IGNORED_PLUGINS, ...(options.suppressPlugins || options.ignoredPlugins || [])];

  const ignoredCodes = new Set(codesList);
  const ignoredPlugins = new Set(pluginsList);

  return {
    name: 'vite-plugin-build-log-modifier',
    config(config) {
      // Build mode (Rolldown/Rollup) logs modifier
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
    configResolved(resolvedConfig) {
      // Dev mode logs modifier via resolvedConfig.logger
      const logger = resolvedConfig.logger;
      const originalWarn = logger.warn;
      const originalWarnOnce = logger.warnOnce;

      const shouldIgnore = (msg: string, options?: LogErrorOptions) => {
        for (const plugin of ignoredPlugins) {
          if (msg.includes(plugin)) return true;
        }
        if (options?.error) {
          const err = options.error as any;
          if (err.code && ignoredCodes.has(err.code)) return true;
          if (err.plugin && ignoredPlugins.has(err.plugin)) return true;
        }
        return false;
      };

      logger.warn = (msg: string, options?: LogOptions) => {
        if (shouldIgnore(msg, options)) return;
        originalWarn.call(logger, msg, options);
      };

      logger.warnOnce = (msg: string, options?: LogOptions) => {
        if (shouldIgnore(msg, options)) return;
        originalWarnOnce.call(logger, msg, options);
      };
    },
  };
}
