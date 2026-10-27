import { loadEnv, type Plugin, type UserConfig, type ConfigEnv } from 'vite';

/**
 * Options for the cssToCdnPlugin.
 */
export interface CssToCdnOptions {
  /**
   * Static CDN base URL to prepend to stylesheet paths (e.g. `'https://cdn.example.com'`).
   */
  cdnUrl?: string;
  /**
   * Environment variable name to read the CDN base URL from if `cdnUrl` is not provided.
   * @default 'BASE_CDN_URL'
   */
  envKey?: string;
  /**
   * Output subdirectory path prefix on the CDN.
   * @default 'cdn'
   */
  cdnDir?: string;
  /**
   * Custom stylesheet output filename (with or without `.css` extension).
   * @default 'main'
   */
  stylesFileName?: string;
  /**
   * Pattern or predicate to filter files that should be transformed.
   * @default /\.(jsx?|tsx?)$/
   */
  include?: RegExp | string;
}

const INLINE_CSS_IMPORT_REGEX = /import\s+([a-zA-Z0-9_$]+)\s+from\s+['"]([^'"]+?\.css)\?inline['"];?/g;

/**
 * Vite plugin to handle CSS for CDN builds:
 * When CDN URL is present:
 *  - Dynamically configures `build.lib.cssFileName` to match stylesFileName
 *  - Automatically converts `?inline` CSS imports to reference CDN stylesheet URLs
 *  - Injects normal CSS import so Vite extracts and compiles the bundle's CSS
 * When CDN URL is absent:
 *  - Leaves `?inline` imports untouched so styles remain inline in the bundle
 *
 * @param options - Configuration options for CDN base URL, environment key, and stylesheet naming.
 * @returns A Vite Plugin object.
 */
export default function cssToCdnPlugin(options: CssToCdnOptions = {}): Plugin {
  const envKey = options.envKey || 'BASE_CDN_URL';
  const cdnDir = (options.cdnDir ?? 'cdn').replace(/^\/+|\/+$/g, '');
  const includePattern = options.include || /\.(jsx?|tsx?)$/;

  let resolvedCdnUrl = options.cdnUrl;
  const baseStylesFileName = (options.stylesFileName || 'main').replace(/\.css$/, '');
  const resolvedStylesFileName = `${baseStylesFileName}.css`;

  const resolveEnvCdn = (mode?: string, envDir?: string | false) => {
    if (!resolvedCdnUrl) {
      const dir = typeof envDir === 'string' ? envDir : process.cwd();
      const env = loadEnv(mode || 'production', dir, '');
      resolvedCdnUrl = process.env[envKey] !== undefined ? process.env[envKey] : env[envKey] || '';
    }
    if (resolvedCdnUrl && !resolvedCdnUrl.endsWith('/')) {
      resolvedCdnUrl = `${resolvedCdnUrl}/`;
    }
    return resolvedCdnUrl;
  };

  return {
    name: 'vite-plugin-css-to-cdn',
    enforce: 'pre',
    config(config: UserConfig, env?: ConfigEnv) {
      const cdnUrl = resolveEnvCdn(env?.mode, config.envDir);
      if (cdnUrl) {
        config.build = config.build || {};
        if (config.build.lib) {
          config.build.lib.cssFileName = baseStylesFileName;
        }
      }
    },
    configResolved(config) {
      resolveEnvCdn(config.mode, config.envDir);
    },
    transform(code: string, id: string) {
      if (!resolvedCdnUrl) return null;

      if (typeof includePattern === 'string' ? !id.includes(includePattern) : !includePattern.test(id)) {
        return null;
      }

      if (!code.includes('?inline') || !code.includes('.css')) {
        return null;
      }

      const cdnCssUrl = `${resolvedCdnUrl}${cdnDir ? `${cdnDir}/` : ''}${resolvedStylesFileName}`;

      let hasMatch = false;
      const transformed = code.replace(INLINE_CSS_IMPORT_REGEX, (_, varName, cssPath) => {
        hasMatch = true;
        return `import '${cssPath}';\nconst ${varName} = ${JSON.stringify(cdnCssUrl)};`;
      });

      if (!hasMatch) return null;

      return {
        code: transformed,
        map: null,
      };
    },
  };
}

export { cssToCdnPlugin as csstoCdn };
