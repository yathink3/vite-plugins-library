import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { logStep } from '../utils/logger';

/**
 * Options for the bundleBudgetPlugin.
 */
export interface BundleBudgetOptions {
  /**
   * Maximum allowed size for an individual JS chunk (e.g. `'500kb'`, `'1mb'`, or number in bytes).
   */
  maxChunkSize?: string | number;
  /**
   * Maximum allowed size for an individual static asset (e.g. `'250kb'`, `'1mb'`, or number in bytes).
   */
  maxAssetSize?: string | number;
  /**
   * Maximum allowed size for total bundle output (e.g. `'2mb'`, `'5mb'`, or number in bytes).
   */
  maxTotalSize?: string | number;
  /**
   * If true, logs warnings on budget breach instead of failing the build with an error.
   * @default true
   */
  warnOnly?: boolean;
  /**
   * Optional filename in output directory to save JSON report (e.g. `'bundle-report.json'`).
   */
  reportFile?: string;
  /**
   * Whether to log a detailed table breakdown of output chunks and assets in terminal log.
   * @default true
   */
  showBreakdown?: boolean;
}

/**
 * Parses size strings like '500kb', '1.5mb', '2000' into byte counts.
 */
function parseBytes(size?: string | number): number | undefined {
  if (size === undefined || size === null) return undefined;
  if (typeof size === 'number') return size;

  const str = size.trim().toLowerCase();
  const match = str.match(/^([\d.]+)\s*([a-z]*)$/);
  if (!match) return undefined;

  const num = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'b':
      return num;
    case 'kb':
    case 'k':
      return num * 1024;
    case 'mb':
    case 'm':
      return num * 1024 * 1024;
    case 'gb':
    case 'g':
      return num * 1024 * 1024 * 1024;
    default:
      return num;
  }
}

/**
 * Formats bytes into human-readable string (e.g. '45.20 KB').
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Vite plugin that audits output bundle sizes during build, enforces configurable size budgets,
 * displays chunk breakdowns, and generates optional JSON reports.
 *
 * @param options - Configuration options for chunk, asset, and total bundle size limits.
 * @returns A Vite Plugin object.
 */
export default function bundleBudgetPlugin(options: BundleBudgetOptions = {}): Plugin {
  const maxChunkBytes = parseBytes(options.maxChunkSize);
  const maxAssetBytes = parseBytes(options.maxAssetSize);
  const maxTotalBytes = parseBytes(options.maxTotalSize);
  const warnOnly = options.warnOnly !== false;
  const showBreakdown = options.showBreakdown !== false;

  let outDir = 'dist';

  return {
    name: 'vite-plugin-bundle-budget',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    generateBundle(_options, bundle) {
      let totalSize = 0;
      const reportItems: Array<{ fileName: string; type: 'chunk' | 'asset'; size: number; formattedSize: string; exceeded: boolean }> = [];
      const violations: string[] = [];

      for (const [fileName, item] of Object.entries(bundle)) {
        let size = 0;
        let isChunk = false;

        if (item.type === 'chunk') {
          isChunk = true;
          size = Buffer.byteLength(item.code, 'utf8');
        } else if (item.type === 'asset') {
          isChunk = false;
          if (typeof item.source === 'string') {
            size = Buffer.byteLength(item.source, 'utf8');
          } else {
            size = item.source.byteLength;
          }
        }

        totalSize += size;
        let exceeded = false;

        if (isChunk && maxChunkBytes && size > maxChunkBytes) {
          exceeded = true;
          violations.push(`Chunk "${fileName}" (${formatBytes(size)}) exceeds maximum chunk budget of ${formatBytes(maxChunkBytes)}.`);
        } else if (!isChunk && maxAssetBytes && size > maxAssetBytes) {
          exceeded = true;
          violations.push(`Asset "${fileName}" (${formatBytes(size)}) exceeds maximum asset budget of ${formatBytes(maxAssetBytes)}.`);
        }

        reportItems.push({
          fileName,
          type: isChunk ? 'chunk' : 'asset',
          size,
          formattedSize: formatBytes(size),
          exceeded,
        });
      }

      if (maxTotalBytes && totalSize > maxTotalBytes) {
        violations.push(`Total bundle size (${formatBytes(totalSize)}) exceeds maximum total budget of ${formatBytes(maxTotalBytes)}.`);
      }

      if (showBreakdown) {
        logStep('budget', `Bundle Audit Summary (Total: ${formatBytes(totalSize)})`);
        reportItems.sort((a, b) => b.size - a.size);
        for (const item of reportItems) {
          const status = item.exceeded ? '[EXCEEDED]' : '[OK]';
          logStep('budget', status, item.fileName.padEnd(40), item.formattedSize);
        }
      }

      if (violations.length > 0) {
        const message = `Bundle Budget Violations:\n` + violations.map(v => ` - ${v}`).join('\n');
        if (warnOnly) {
          logStep('budget', '[WARNING]', message);
        } else {
          this.error(message);
        }
      }

      if (options.reportFile) {
        const reportPath = path.isAbsolute(options.reportFile)
          ? options.reportFile
          : path.join(outDir, options.reportFile);

        const reportData = {
          timestamp: new Date().toISOString(),
          totalSize,
          formattedTotalSize: formatBytes(totalSize),
          violationsCount: violations.length,
          violations,
          items: reportItems,
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
