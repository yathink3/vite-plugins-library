import type { Plugin } from 'vite';
import devFallbackPlugin, { type MockEndpoint } from './devFallback';

export type { MockEndpoint };

/**
 * Options for the apiMockPlugin.
 */
export interface ApiMockPluginOptions {
  /**
   * Array of mock API endpoint definitions.
   */
  mocks?: MockEndpoint[];
  /**
   * Global URL path prefix to match for mock routing.
   * @default '/api'
   */
  prefix?: string;
  /**
   * Enable or disable mock middleware in dev server.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Vite plugin that injects development server middleware to intercept local API requests (e.g. `/api/*`) and serve mock JSON responses or custom handlers.
 *
 * @deprecated Prefer using `devFallbackPlugin` (`vite-plugins-library/dev-fallback`) with `mocks` options for unified dev server network intercepting.
 * @param options - Configuration options for mock endpoint definitions, URL prefixes, and simulated latency.
 * @returns A Vite Plugin object.
 */
export default function apiMockPlugin(options: ApiMockPluginOptions = {}): Plugin {
  const mocks = options.enabled !== false ? options.mocks || [] : [];
  const prefix = options.prefix || '/api';

  const fallback = devFallbackPlugin({
    mocks,
    mockPrefix: prefix,
    catchProxyErrors: false,
  });

  return {
    ...fallback,
    name: 'vite-plugin-api-mock',
  };
}
