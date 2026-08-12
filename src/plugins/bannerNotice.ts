import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface BannerNoticeOptions {
  /**
   * Banner text string or template to prepend to bundle assets.
   * Supports placeholders: `[name]`, `[version]`, `[author]`, `[license]`, `[year]`, `[date]`, `[hash]`
   */
  banner: string;
  /**
   * Custom project or library name to replace `[name]`.
   */
  projectName?: string;
  /**
   * Author or organization name to replace `[author]`.
   */
  author?: string;
  /**
   * License string to replace `[license]`.
   */
  license?: string;
  /**
   * Target file extension or RegExp patterns to include.
   * @default /\.(js|mjs|cjs|css)$/i
   */
  include?: RegExp | string | Array<RegExp | string>;
  /**
   * Target file extension or RegExp patterns to exclude.
   */
  exclude?: RegExp | string | Array<RegExp | string>;
  /**
   * Automatically wrap non-commented banners in block comment tags (`/* ... *\/`).
   * @default true
   */
  verifyCommentFormatting?: boolean;
}

function matchesPattern(filename: string, pattern?: RegExp | string | Array<RegExp | string>): boolean {
  if (!pattern) return false;
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  return patterns.some((p) => {
    if (typeof p === 'string') return filename.endsWith(p) || filename.includes(p);
    return p.test(filename);
  });
}

/**
 * Vite plugin to prepend customizable copyright, license, version, git commit hash, and build timestamp banners
 * to JS and CSS production bundle outputs.
 *
 * @param options Banner template string and placeholder variables.
 * @returns Vite Plugin instance.
 */
export default function bannerNoticePlugin(options: BannerNoticeOptions): Plugin {
  let pkgInfo: { name?: string; version?: string; author?: string; license?: string } = {};

  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      pkgInfo = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    }
  } catch {
    pkgInfo = {};
  }

  return {
    name: 'vite-plugin-banner-notice',
    apply: 'build',
    renderChunk(code, chunk) {
      const fileName = chunk.fileName;

      if (options.exclude && matchesPattern(fileName, options.exclude)) {
        return null;
      }

      const defaultInclude = /\.(js|mjs|cjs)$/i;
      const shouldInclude = options.include
        ? matchesPattern(fileName, options.include)
        : defaultInclude.test(fileName);

      if (!shouldInclude) return null;

      const dateStr = new Date().toISOString().split('T')[0];
      const yearStr = String(new Date().getFullYear());
      const buildHash = (chunk as any).hash || Math.random().toString(36).slice(2, 10);

      let bannerText = options.banner
        .replace(/\[name\]/g, options.projectName || pkgInfo.name || 'app')
        .replace(/\[version\]/g, pkgInfo.version || '1.0.0')
        .replace(/\[author\]/g, options.author || (typeof pkgInfo.author === 'string' ? pkgInfo.author : '') || '')
        .replace(/\[license\]/g, options.license || pkgInfo.license || 'MIT')
        .replace(/\[year\]/g, yearStr)
        .replace(/\[date\]/g, dateStr)
        .replace(/\[hash\]/g, buildHash);

      const wrapInComment = options.verifyCommentFormatting !== false;
      if (wrapInComment && !bannerText.trim().startsWith('/*')) {
        const lines = bannerText.split('\n');
        bannerText = `/*!\n${lines.map((l) => ` * ${l}`).join('\n')}\n */`;
      }

      return {
        code: `${bannerText}\n${code}`,
        map: null,
      };
    },
    generateBundle(_opts, bundle) {
      // Also apply banner to CSS assets in bundle
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue;

        if (options.exclude && matchesPattern(fileName, options.exclude)) continue;
        if (options.include && !matchesPattern(fileName, options.include)) continue;

        const dateStr = new Date().toISOString().split('T')[0];
        const yearStr = String(new Date().getFullYear());

        let bannerText = options.banner
          .replace(/\[name\]/g, options.projectName || pkgInfo.name || 'app')
          .replace(/\[version\]/g, pkgInfo.version || '1.0.0')
          .replace(/\[author\]/g, options.author || (typeof pkgInfo.author === 'string' ? pkgInfo.author : '') || '')
          .replace(/\[license\]/g, options.license || pkgInfo.license || 'MIT')
          .replace(/\[year\]/g, yearStr)
          .replace(/\[date\]/g, dateStr)
          .replace(/\[hash\]/g, 'css');

        const wrapInComment = options.verifyCommentFormatting !== false;
        if (wrapInComment && !bannerText.trim().startsWith('/*')) {
          const lines = bannerText.split('\n');
          bannerText = `/*!\n${lines.map((l) => ` * ${l}`).join('\n')}\n */`;
        }

        if (typeof asset.source === 'string') {
          asset.source = `${bannerText}\n${asset.source}`;
        }
      }
    },
  };
}
