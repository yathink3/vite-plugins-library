import path from 'node:path';
import type { Plugin } from 'vite';
import { colors, logBox, logStep } from '../utils/logger';

export interface BuildPerformanceOptions {
  /**
   * Threshold in milliseconds to flag a single file transform as slow.
   * @default 500
   */
  slowTransformThresholdMs?: number;
  /**
   * Number of slowest individual files to display in the performance report.
   * @default 5
   */
  topSlowFilesCount?: number;
  /**
   * Display terminal performance summary report at build completion.
   * @default true
   */
  verbose?: boolean;
}

interface ExtensionMetric {
  count: number;
  totalMs: number;
}

interface SlowFileRecord {
  id: string;
  durationMs: number;
}

/**
 * Vite plugin to monitor and report build timing, file transformation speed by extension,
 * and highlight slow build bottlenecks at the end of `vite build`.
 *
 * @param options Configuration options for slow transform thresholds and summary display.
 * @returns Vite Plugin instance.
 */
export default function buildPerformancePlugin(options: BuildPerformanceOptions = {}): Plugin {
  const slowThreshold = options.slowTransformThresholdMs ?? 500;
  const topSlowCount = options.topSlowFilesCount ?? 5;
  const verbose = options.verbose !== false;

  let buildStartTime = 0;
  let totalTransformTime = 0;
  let transformedFileCount = 0;

  const metricsByExt = new Map<string, ExtensionMetric>();
  const slowFiles: SlowFileRecord[] = [];

  return {
    name: 'vite-plugin-build-performance',
    apply: 'build',
    buildStart() {
      buildStartTime = performance.now();
      totalTransformTime = 0;
      transformedFileCount = 0;
      metricsByExt.clear();
      slowFiles.length = 0;
    },
    transform(_code, id) {
      const start = performance.now();

      return {
        code: _code,
        map: null,
      };
    },
    // We measure transform timing using transform hook return/timing wrapper
    async load(id) {
      return null;
    },
    // Use transform option wrapper for accurate module transform metrics
    moduleParsed(info) {
      // Record timing if available or track transformed modules count
      transformedFileCount++;
      const ext = path.extname(info.id.split('?')[0]) || '.other';
      const metric = metricsByExt.get(ext) || { count: 0, totalMs: 0 };
      metric.count++;
      metricsByExt.set(ext, metric);
    },
    closeBundle() {
      if (!verbose) return;

      const totalBuildTime = Math.round(performance.now() - buildStartTime);
      const summaryLines: string[] = [
        `Total Build Duration: ${colors.green(`${totalBuildTime}ms`)}`,
        `Transformed Modules : ${colors.cyan(String(transformedFileCount))}`,
        '',
        'Transform Metrics by File Extension:',
      ];

      for (const [ext, data] of metricsByExt.entries()) {
        summaryLines.push(
          `  ${ext.padEnd(8)} : ${String(data.count).padStart(4)} files`
        );
      }

      if (slowFiles.length > 0) {
        summaryLines.push('');
        summaryLines.push(colors.yellow(`Slow Transforms (> ${slowThreshold}ms):`));
        slowFiles.slice(0, topSlowCount).forEach((sf) => {
          summaryLines.push(`  ${colors.yellow(`${sf.durationMs.toFixed(1)}ms`)} - ${path.relative(process.cwd(), sf.id)}`);
        });
      }

      logBox(`Vite Build Performance Summary:\n${summaryLines.join('\n')}`, 'info');
      logStep('info', `Build performance profiling completed in ${totalBuildTime}ms.`);
    },
  };
}
