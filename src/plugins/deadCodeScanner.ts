import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { logStep } from '../utils/logger';

/**
 * Options for the deadCodeScannerPlugin.
 */
export interface DeadCodeScannerOptions {
  /**
   * Directories to scan for unused static files relative to project root.
   * @default ['public', 'src/assets']
   */
  targetDirs?: string[];
  /**
   * File patterns or names to exclude from unused dead code audit (e.g. `['favicon.ico', 'robots.txt']`).
   * @default ['favicon.ico', 'robots.txt', 'manifest.json', 'sitemap.xml']
   */
  exclude?: (string | RegExp)[];
  /**
   * Log warnings instead of throwing build errors when unused files are detected.
   * @default true
   */
  warnOnly?: boolean;
  /**
   * Output JSON filename in build dist directory to save unused asset list.
   */
  reportFile?: string;
}

const DEFAULT_EXCLUDES = ['favicon.ico', 'robots.txt', 'manifest.json', 'sitemap.xml', '.DS_Store'];

/**
 * Recursively scans directory to return all relative file paths.
 */
function scanDirectory(dirPath: string, rootDir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanDirectory(fullPath, rootDir));
    } else {
      results.push(path.relative(rootDir, fullPath));
    }
  }

  return results;
}

/**
 * Vite plugin that audits static assets in `public/` and `src/assets/` against referenced modules in build output
 * to identify unreferenced / dead code assets.
 *
 * @param options - Configuration options for scan target directories and exclusion rules.
 * @returns A Vite Plugin object.
 */
export default function deadCodeScannerPlugin(options: DeadCodeScannerOptions = {}): Plugin {
  const targetDirs = options.targetDirs || ['public', 'src/assets'];
  const excludes = [...DEFAULT_EXCLUDES, ...(options.exclude || [])];
  const warnOnly = options.warnOnly !== false;

  const accumulatedCodeContent: string[] = [];
  let projectRoot = process.cwd();
  let outDir = 'dist';

  return {
    name: 'vite-plugin-dead-code-scanner',
    apply: 'build',
    configResolved(config) {
      projectRoot = config.root || process.cwd();
      outDir = config.build.outDir || 'dist';
    },
    transform(code, id) {
      if (!id.includes('node_modules')) {
        accumulatedCodeContent.push(code);
      }
      return null;
    },
    transformIndexHtml(html) {
      accumulatedCodeContent.push(html);
    },
    generateBundle(_options, bundle) {
      // 1. Collect all asset paths in targetDirs
      const allTargetFiles: { relativePath: string; absolutePath: string; basename: string }[] = [];

      for (const targetDir of targetDirs) {
        const absDir = path.resolve(projectRoot, targetDir);
        if (!fs.existsSync(absDir)) continue;

        const files = scanDirectory(absDir, projectRoot);
        for (const file of files) {
          const basename = path.basename(file);

          // Check if excluded
          const isExcluded = excludes.some(pattern => {
            if (typeof pattern === 'string') return file.includes(pattern) || basename === pattern;
            if (pattern instanceof RegExp) return pattern.test(file);
            return false;
          });

          if (!isExcluded) {
            allTargetFiles.push({
              relativePath: file,
              absolutePath: path.resolve(projectRoot, file),
              basename,
            });
          }
        }
      }

      // 2. Build massive search context from bundle chunks and accumulated source code
      const searchContexts: string[] = [...accumulatedCodeContent];
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk') {
          searchContexts.push(item.code);
        } else if (item.type === 'asset' && typeof item.source === 'string') {
          searchContexts.push(item.source);
        }
      }

      const combinedText = searchContexts.join('\n');

      // 3. Check which files in targetDirs were never referenced
      const unusedFiles: string[] = [];

      for (const targetFile of allTargetFiles) {
        const relPathClean = targetFile.relativePath.replace(/\\/g, '/');
        const basename = targetFile.basename;

        // Check if path or filename appears in code/html/bundle
        const isReferenced = combinedText.includes(relPathClean) || combinedText.includes(basename);

        if (!isReferenced) {
          unusedFiles.push(relPathClean);
        }
      }

      if (unusedFiles.length > 0) {
        logStep('dead-code', `Found ${unusedFiles.length} unreferenced static asset(s):`);
        for (const file of unusedFiles) {
          logStep('dead-code', '[UNUSED]', file);
        }

        if (!warnOnly) {
          this.error(`Dead Code Audit failed: ${unusedFiles.length} unused static asset(s) detected.`);
        }
      } else {
        logStep('dead-code', '[OK]', 'No unreferenced static assets detected in target directories.');
      }

      if (options.reportFile) {
        const reportData = {
          timestamp: new Date().toISOString(),
          scannedDirectories: targetDirs,
          totalFilesScanned: allTargetFiles.length,
          unusedCount: unusedFiles.length,
          unusedFiles,
        };

        this.emitFile({
          type: 'asset',
          fileName: options.reportFile,
          source: JSON.stringify(reportData, null, 2),
        });
      }
    },
  };
}
