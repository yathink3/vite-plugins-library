import type { Plugin } from 'vite';

export interface BuildLogModifierOptions {
  ignoredCodes?: string[];
  ignoredPlugins?: string[];
}

const DEFAULT_IGNORED_CODES = ['EVAL', 'EMPTY_IMPORT_META'];
const DEFAULT_IGNORED_PLUGINS = ['builtin:vite-reporter'];

export default function buildLogModifierPlugin(options: BuildLogModifierOptions = {}): Plugin {
  const ignoredCodes = new Set(options.ignoredCodes || DEFAULT_IGNORED_CODES);
  const ignoredPlugins = new Set(options.ignoredPlugins || DEFAULT_IGNORED_PLUGINS);

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
