import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { logStep } from '../utils/logger';

export interface CacheCleanerOptions {
  /**
   * Array of file paths (relative to project root) to monitor for changes.
   * Defaults to `['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb']`.
   */
  watchFiles?: string[];
  /**
   * Directory containing Vite's optimized dependency cache.
   * @default 'node_modules/.vite'
   */
  cacheDir?: string;
  /**
   * Force clean cache on every dev server start regardless of file hashes.
   * @default false
   */
  forceClean?: boolean;
  /**
   * Log CLI notification when cache is purged.
   * @default true
   */
  verbose?: boolean;
}

function calculateFilesHash(rootDir: string, files: string[]): string {
  const hash = crypto.createHash('sha256');
  let fileCount = 0;

  for (const file of files) {
    const fullPath = path.resolve(rootDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath);
        hash.update(file);
        hash.update(content);
        fileCount++;
      } catch {
        // Skip unreadable files
      }
    }
  }

  return fileCount > 0 ? hash.digest('hex') : '';
}

/**
 * Vite plugin that detects dependency updates in `package.json` or lockfiles and automatically cleans
 * Vite's `node_modules/.vite` cache on dev server restart, resolving "Failed to resolve import" errors.
 *
 * @param options Configuration for watched lockfiles, target cache directory, and force cleaning.
 * @returns Vite Plugin instance.
 */
export default function cacheCleanerPlugin(options: CacheCleanerOptions = {}): Plugin {
  const watchFiles = options.watchFiles || [
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
  ];
  const verbose = options.verbose !== false;

  return {
    name: 'vite-plugin-cache-cleaner',
    apply: 'serve',
    configResolved(config) {
      const rootDir = config.root || process.cwd();
      const targetCacheDir = options.cacheDir
        ? path.resolve(rootDir, options.cacheDir)
        : path.resolve(rootDir, config.cacheDir || 'node_modules/.vite');

      const stampFile = path.join(targetCacheDir, '.cache-stamp.json');
      const currentHash = calculateFilesHash(rootDir, watchFiles);

      if (!currentHash) return;

      let storedHash = '';
      if (fs.existsSync(stampFile)) {
        try {
          const stampData = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
          storedHash = stampData.hash || '';
        } catch {
          storedHash = '';
        }
      }

      const shouldClean = options.forceClean || storedHash !== currentHash;

      if (shouldClean && fs.existsSync(targetCacheDir)) {
        try {
          // Remove cache files except stamp
          const items = fs.readdirSync(targetCacheDir);
          for (const item of items) {
            const itemPath = path.join(targetCacheDir, item);
            if (itemPath === stampFile) continue;
            fs.rmSync(itemPath, { recursive: true, force: true });
          }

          if (verbose) {
            logStep(
              'info',
              `Purged stale Vite dependency cache at ${path.relative(rootDir, targetCacheDir)} due to updated dependencies.`
            );
          }
        } catch (err: any) {
          if (verbose) {
            logStep('warn', `Failed to purge Vite dependency cache: ${err.message}`);
          }
        }
      }

      // Write updated stamp
      try {
        if (!fs.existsSync(targetCacheDir)) {
          fs.mkdirSync(targetCacheDir, { recursive: true });
        }
        fs.writeFileSync(
          stampFile,
          JSON.stringify({ hash: currentHash, updatedAt: new Date().toISOString() }, null, 2),
          'utf8'
        );
      } catch {
        // Ignore stamp write failure
      }
    },
  };
}
