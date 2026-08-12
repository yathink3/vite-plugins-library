import { loadEnv, type Plugin, type UserConfig } from 'vite';

export interface ImageToCdnOptions {
  cdnUrl?: string;
  envKey?: string;
  allowedExtensions?: string[];
}

const DEFAULT_SAFE_EXTS = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'avif']);
const IMAGE_REGEX = /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i;

const getSafeFileName = (fullPath: string, safeExts: Set<string>) => {
  const fileNameWithExt = fullPath.split('/').pop() || '';
  const lastDotIndex = fileNameWithExt.lastIndexOf('.');

  if (lastDotIndex === -1) return fileNameWithExt;

  const name = fileNameWithExt.slice(0, lastDotIndex);
  const ext = fileNameWithExt.slice(lastDotIndex + 1).toLowerCase();

  if (safeExts.has(ext)) {
    if (!name) return `a/${fileNameWithExt}`;
    const chunkName = name.slice(0, 25).toLowerCase();
    return `a/${chunkName}.${ext}`;
  }

  return `a/${fileNameWithExt}`;
};

/**
 * Plugin to replace local image imports with static CDN URLs during production builds.
 */
export default function imageToCdnPlugin(options: ImageToCdnOptions = {}): Plugin {
  const envKey = options.envKey || 'BASE_CDN_URL';
  const safeExts = options.allowedExtensions ? new Set(options.allowedExtensions) : DEFAULT_SAFE_EXTS;

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
      const shortName = getSafeFileName(id, safeExts);
      const finalUrl = baseUrl + shortName;
      return `export default ${JSON.stringify(finalUrl)};`;
    },
  };
}
