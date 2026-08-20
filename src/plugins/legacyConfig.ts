import type { Plugin } from 'vite';

/**
 * Vite plugin to automatically apply all known legacy configuration options by default.
 * These flags help maintain backwards compatibility during Vite version upgrades.
 *
 * @param customOptions - Optional custom overrides for legacy options.
 * @returns A Vite Plugin object.
 */
export default function legacyConfigPlugin(customOptions?: Record<string, any>): Plugin {
  return {
    name: 'vite-plugin-legacy-config',
    config(config) {
      const conf = config as any;

      // Known legacy configuration options from various Vite versions
      const defaultLegacyOptions = {
        // Vite 8 / Rolldown interop fallback
        inconsistentCjsInterop: true,
        // Vite 6.0.9+ websocket token check fallback
        skipWebSocketTokenCheck: true,
      };

      conf.legacy = {
        ...defaultLegacyOptions,
        ...conf.legacy,
        ...customOptions,
      };
    },
  };
}
