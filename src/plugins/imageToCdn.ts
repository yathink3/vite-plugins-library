import { loadEnv, type Plugin, type UserConfig } from 'vite';

/**
 * Options for the imageToCdnPlugin.
 */
export interface ImageToCdnOptions {
  /**
   * Static CDN base URL to prepend to local image import paths (e.g. `'https://cdn.example.com'`).
   */
  cdnUrl?: string;
  /**
   * Environment variable name to read the CDN base URL from if `cdnUrl` is not provided.
   * @default 'BASE_CDN_URL'
   */
  envKey?: string;
  /**
   * File extensions to rewrite to static CDN URLs during production builds.
   * @default ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif']
   */
  allowedExtensions?: string[];
  /**
   * Alias for `allowedExtensions`. Supports extension strings with or without leading dots (e.g. `['.png', 'jpg']`).
   */
  extensions?: string[];
  /**
   * Output subdirectory path prefix for CDN assets.
   * @default 'a'
   */
  assetDir?: string;
}

const DEFAULT_SAFE_EXTS = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif']);
const IMAGE_REGEX = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i;

const getSafeFileName = (fullPath: string, safeExts: Set<string>, assetDir: string) => {
  const fileNameWithExt = fullPath.split('/').pop() || '';
  const lastDotIndex = fileNameWithExt.lastIndexOf('.');

  if (lastDotIndex === -1) return fileNameWithExt;

  const name = fileNameWithExt.slice(0, lastDotIndex);
  const ext = fileNameWithExt.slice(lastDotIndex + 1).toLowerCase();

  const prefix = assetDir ? `${assetDir}/` : '';

  if (safeExts.has(ext)) {
    if (!name) return `${prefix}${fileNameWithExt}`;
    const chunkName = name.slice(0, 25).toLowerCase();
    return `${prefix}${chunkName}.${ext}`;
  }

  return `${prefix}${fileNameWithExt}`;
};

/**
 * Vite plugin to replace local image imports with static CDN URLs during production builds.
 *
 * @param options - Configuration options for CDN base URL, environment key, allowed file extensions, and asset subdirectories.
 * @returns A Vite Plugin object.
 */
export default function imageToCdnPlugin(options: ImageToCdnOptions = {}): Plugin {
  const envKey = options.envKey || 'BASE_CDN_URL';
  const assetDir = (options.assetDir ?? 'a').replace(/\/+$/, '');

  const extList = options.extensions || options.allowedExtensions;
  const safeExts = extList
    ? new Set(extList.map(e => e.replace(/^\./, '').toLowerCase()))
    : DEFAULT_SAFE_EXTS;

  let baseUrl = options.cdnUrl;

  return {
    name: 'vite-plugin-image-to-cdn',
    enforce: 'pre',
    configResolved(config) {
      if (!baseUrl) {
        const env = loadEnv(config.mode, config.envDir || process.cwd(), '');
        baseUrl = env[envKey] || '';
      }
      if (baseUrl && !baseUrl.endsWith('/')) {
        baseUrl = `${baseUrl}/`;
      }
    },
    config(config: UserConfig) {
      config.build = config.build || {};
      config.build.assetsInlineLimit = 0;
    },
    load(id: string) {
      if (!baseUrl || !IMAGE_REGEX.test(id)) return null;
      const shortName = getSafeFileName(id, safeExts, assetDir);
      const finalUrl = baseUrl + shortName;
      return `export default ${JSON.stringify(finalUrl)};`;
    },
  };
}
