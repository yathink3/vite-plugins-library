import type { Plugin } from 'vite';
import { logStep } from '../utils/logger';

/**
 * Definition of a single mock API endpoint route.
 */
export interface MockEndpoint {
  /**
   * Target URL path to intercept (e.g. `'/api/users'` or `'/api/v1/auth'`).
   */
  url: string;
  /**
   * HTTP Method to match.
   * @default 'GET'
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | string;
  /**
   * Response payload (JSON object/array) or handler function `(req, res) => void`.
   */
  response: any | ((req: any, res: any) => void);
  /**
   * Simulated network delay in milliseconds.
   * @default 0
   */
  delay?: number;
}

/**
 * Definition for a custom URL fallback handler.
 */
export interface DevFallbackRule {
  /**
   * Target URL path string or regex pattern to match (e.g. `'/api/'` or `/^\/api\/v1/`).
   */
  match: string | RegExp;
  /**
   * HTTP status code to respond with.
   * @default 200
   */
  status?: number;
  /**
   * Custom response object/string or handler function `(req, res) => void`.
   */
  response: any | ((req: any, res: any) => void);
}

/**
 * Options for the devFallbackPlugin.
 */
export interface DevFallbackOptions {
  /**
   * Array of mock API endpoint definitions with method matching and simulated latency.
   */
  mocks?: MockEndpoint[];
  /**
   * Global URL path prefix for mock endpoints.
   * @default '/api'
   */
  mockPrefix?: string;
  /**
   * List of URL matching rules and fallback responses.
   */
  rules?: DevFallbackRule[];
  /**
   * Whether to automatically intercept dev server proxy error events (ECONNREFUSED / 502 / 504)
   * and return friendly fallback JSON responses instead of crashing or socket error.
   * @default true
   */
  catchProxyErrors?: boolean;
  /**
   * Custom HTML string or fallback route path for unhandled 404 routes during development.
   */
  spaFallbackHtml?: string;
}

/**
 * Vite plugin that unifies API mocking, dev server proxy error recovery, 404 route fallbacks, and offline response handling.
 *
 * @param options - Configuration options for mock endpoints, matching rules, proxy error handling, and SPA fallbacks.
 * @returns A Vite Plugin object.
 */
export default function devFallbackPlugin(options: DevFallbackOptions = {}): Plugin {
  const mocks = options.mocks || [];
  const globalPrefix = (options.mockPrefix || '/api').replace(/\/+$/, '');
  const rules = options.rules || [];
  const catchProxyErrors = options.catchProxyErrors !== false;
  const spaFallbackHtml = options.spaFallbackHtml;

  return {
    name: 'vite-plugin-dev-fallback',
    apply: 'serve',
    configureServer(server) {
      // 1. Intercept Proxy Errors if enabled
      if (catchProxyErrors && server.config.server.proxy) {
        server.httpServer?.on('listening', () => {
          logStep('fallback', '[INFO]', 'Dev proxy failure & network fallback interceptor active');
        });
      }

      // 2. Middleware to match mocks, request rules, and SPA fallbacks
      server.middlewares.use((req, res, next) => {
        const reqUrl = req.url?.split('?')[0] || '';
        const reqMethod = (req.method || 'GET').toUpperCase();

        // 2a. Check Mock Endpoints first
        if (mocks.length > 0) {
          const matchMock = mocks.find(m => {
            const endpointUrl = m.url.startsWith('/') ? m.url : `/${m.url}`;
            const fullPath = endpointUrl.startsWith(globalPrefix) ? endpointUrl : `${globalPrefix}${endpointUrl}`;
            const methodMatch = !m.method || m.method.toUpperCase() === reqMethod;
            return (reqUrl === fullPath || reqUrl === endpointUrl) && methodMatch;
          });

          if (matchMock) {
            logStep('fallback', '[MOCK]', reqMethod, reqUrl, '→ 200 OK');

            const sendResponse = () => {
              if (typeof matchMock.response === 'function') {
                matchMock.response(req, res);
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify(matchMock.response));
              }
            };

            if (matchMock.delay && matchMock.delay > 0) {
              setTimeout(sendResponse, matchMock.delay);
            } else {
              sendResponse();
            }
            return;
          }
        }

        // 2b. Match against defined rules
        const matchedRule = rules.find(rule => {
          if (typeof rule.match === 'string') {
            return reqUrl.startsWith(rule.match) || reqUrl === rule.match;
          }
          if (rule.match instanceof RegExp) {
            return rule.match.test(rule.match.source);
          }
          return false;
        });

        if (matchedRule) {
          logStep('fallback', '[INTERCEPT]', reqMethod, reqUrl, '→ Fallback Response');
          const status = matchedRule.status || 200;

          if (typeof matchedRule.response === 'function') {
            return matchedRule.response(req, res);
          }

          res.statusCode = status;
          if (typeof matchedRule.response === 'object') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(matchedRule.response));
          } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(String(matchedRule.response));
          }
          return;
        }

        // 2c. SPA HTML Fallback handler if configured
        if (spaFallbackHtml && req.headers.accept?.includes('text/html') && !reqUrl.includes('.')) {
          const originalEnd = res.end;
          res.end = function (...args: any[]) {
            if (res.statusCode === 404) {
              logStep('fallback', '[SPA FALLBACK]', reqUrl);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              return (originalEnd as any).call(res, spaFallbackHtml);
            }
            return originalEnd.apply(res, args as any);
          };
        }

        next();
      });
    },
  };
}
