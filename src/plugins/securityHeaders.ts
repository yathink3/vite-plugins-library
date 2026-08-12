import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { logStep } from '../utils/logger';

export interface SecurityHeadersOptions {
  /**
   * Content Security Policy (CSP) string or directive dictionary.
   * e.g., { 'default-src': ["'self'"], 'script-src': ["'self'", "'unsafe-inline'"] }
   */
  contentSecurityPolicy?: string | Record<string, string[]>;
  /**
   * Cross-Origin Opener Policy (COOP). Required for SharedArrayBuffer support.
   * @default 'same-origin'
   */
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;
  /**
   * Cross-Origin Embedder Policy (COEP).
   */
  crossOriginEmbedderPolicy?: 'require-corp' | 'credentialless' | 'unsafe-none' | false;
  /**
   * Cross-Origin Resource Policy (CORP).
   */
  crossOriginResourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin' | false;
  /**
   * Prevents site framing attacks (X-Frame-Options).
   * @default 'SAMEORIGIN'
   */
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /**
   * Prevents MIME-type sniffing (X-Content-Type-Options).
   * @default 'nosniff'
   */
  xContentTypeOptions?: 'nosniff' | false;
  /**
   * Controls referrer information sent with requests.
   * @default 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: string | false;
  /**
   * HTTP Strict Transport Security (HSTS).
   * @default 'max-age=31536000; includeSubDomains'
   */
  strictTransportSecurity?: string | false;
  /**
   * Feature and permissions policy.
   * e.g., { camera: ["'none'"], geolocation: ["'self'"] }
   */
  permissionsPolicy?: string | Record<string, string[]>;
  /**
   * Additional custom response headers.
   */
  headers?: Record<string, string>;
  /**
   * Format(s) to automatically export headers for production hosting platforms.
   * Options: 'cloudflare' | 'netlify' | 'vercel' | 'nginx' or an array of these.
   */
  exportFormat?: 'cloudflare' | 'netlify' | 'vercel' | 'nginx' | Array<'cloudflare' | 'netlify' | 'vercel' | 'nginx'>;
}

function buildCspString(csp: string | Record<string, string[]>): string {
  if (typeof csp === 'string') return csp;
  return Object.entries(csp)
    .map(([key, vals]) => `${key} ${vals.join(' ')}`)
    .join('; ');
}

function buildPermissionsPolicyString(pp: string | Record<string, string[]>): string {
  if (typeof pp === 'string') return pp;
  return Object.entries(pp)
    .map(([key, vals]) => `${key}=(${vals.join(' ')})`)
    .join(', ');
}

export function generateHeadersMap(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (options.contentSecurityPolicy) {
    headers['Content-Security-Policy'] = buildCspString(options.contentSecurityPolicy);
  }

  if (options.crossOriginOpenerPolicy !== false) {
    headers['Cross-Origin-Opener-Policy'] = options.crossOriginOpenerPolicy || 'same-origin';
  }

  if (options.crossOriginEmbedderPolicy) {
    headers['Cross-Origin-Embedder-Policy'] = options.crossOriginEmbedderPolicy;
  }

  if (options.crossOriginResourcePolicy) {
    headers['Cross-Origin-Resource-Policy'] = options.crossOriginResourcePolicy;
  }

  if (options.xFrameOptions !== false) {
    headers['X-Frame-Options'] = options.xFrameOptions || 'SAMEORIGIN';
  }

  if (options.xContentTypeOptions !== false) {
    headers['X-Content-Type-Options'] = options.xContentTypeOptions || 'nosniff';
  }

  if (options.referrerPolicy !== false) {
    headers['Referrer-Policy'] = options.referrerPolicy || 'strict-origin-when-cross-origin';
  }

  if (options.strictTransportSecurity !== false) {
    headers['Strict-Transport-Security'] = options.strictTransportSecurity || 'max-age=31536000; includeSubDomains';
  }

  if (options.permissionsPolicy) {
    headers['Permissions-Policy'] = buildPermissionsPolicyString(options.permissionsPolicy);
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  return headers;
}

/**
 * Vite plugin to enforce security headers (CSP, COOP, COEP, HSTS, X-Frame-Options) on dev/preview servers
 * and generate production security header configuration files (_headers, vercel.json, nginx.conf).
 *
 * @param options Configuration options for security headers and export formats.
 * @returns Vite Plugin instance.
 */
export default function securityHeadersPlugin(options: SecurityHeadersOptions = {}): Plugin {
  let resolvedOutDir = 'dist';
  const headersMap = generateHeadersMap(options);

  const applyMiddleware = (server: { middlewares: { use: Function } }) => {
    server.middlewares.use((_req: any, res: any, next: () => void) => {
      for (const [key, value] of Object.entries(headersMap)) {
        res.setHeader(key, value);
      }
      next();
    });
  };

  return {
    name: 'vite-plugin-security-headers',
    configResolved(config) {
      resolvedOutDir = config.build.outDir || 'dist';
    },
    configureServer: applyMiddleware,
    configurePreviewServer: applyMiddleware,
    writeBundle() {
      if (!options.exportFormat) return;

      const formats = Array.isArray(options.exportFormat) ? options.exportFormat : [options.exportFormat];
      const targetDir = path.resolve(resolvedOutDir);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      for (const fmt of formats) {
        if (fmt === 'cloudflare' || fmt === 'netlify') {
          const filePath = path.join(targetDir, '_headers');
          let content = '/*\n';
          for (const [k, v] of Object.entries(headersMap)) {
            content += `  ${k}: ${v}\n`;
          }
          fs.writeFileSync(filePath, content, 'utf8');
          logStep('info', `Generated ${fmt} headers at ${path.basename(filePath)}`);
        } else if (fmt === 'vercel') {
          const filePath = path.join(targetDir, 'vercel.json');
          let existingData: Record<string, any> = {};
          if (fs.existsSync(filePath)) {
            try {
              existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch {
              existingData = {};
            }
          }

          const headerEntries = Object.entries(headersMap).map(([key, value]) => ({ key, value }));
          existingData.headers = [
            ...(existingData.headers || []),
            {
              source: '/(.*)',
              headers: headerEntries,
            },
          ];

          fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf8');
          logStep('info', `Generated Vercel security headers configuration in vercel.json`);
        } else if (fmt === 'nginx') {
          const filePath = path.join(targetDir, 'nginx-security.conf');
          let content = '# Security Headers Nginx snippet\n';
          for (const [k, v] of Object.entries(headersMap)) {
            content += `add_header ${k} "${v.replace(/"/g, '\\"')}" always;\n`;
          }
          fs.writeFileSync(filePath, content, 'utf8');
          logStep('info', `Generated Nginx security headers snippet at nginx-security.conf`);
        }
      }
    },
  };
}
