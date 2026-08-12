import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { colors, logBox, logStep } from '../utils/logger';

/**
 * Options for the combined buildScorerPlugin.
 */
export interface BuildScorerOptions {
  /**
   * Maximum recommended single JS chunk size in KB (e.g., `500` or `'500kb'`).
   * @default 500
   */
  maxChunkSizeKb?: number;
  /**
   * Alias for `maxChunkSizeKb` supporting string size formats like `'500kb'` or `'1mb'`.
   */
  maxChunkSize?: string | number;
  /**
   * Target maximum total bundle size in MB (e.g., `5` or `'5mb'`).
   * @default 5
   */
  maxTotalBundleMb?: number;
  /**
   * Alias for `maxTotalBundleMb` supporting string size formats like `'5mb'`.
   */
  maxTotalSize?: string | number;
  /**
   * Maximum allowed size for an individual static asset (e.g. `'250kb'`, `'1mb'`, or bytes).
   */
  maxAssetSize?: string | number;
  /**
   * Threshold in milliseconds to flag a single file transform as slow.
   * @default 500
   */
  slowTransformThresholdMs?: number;
  /**
   * Number of slowest individual files to display in performance report.
   * @default 5
   */
  topSlowFilesCount?: number;
  /**
   * Track module transform timing performance metrics during build.
   * @default true
   */
  trackPerformance?: boolean;
  /**
   * Minimum passing score (0-100) when `strict: true` is enabled.
   * @default 70
   */
  minScoreToPass?: number;
  /**
   * Throw build error if final project score is lower than `minScoreToPass`.
   * @default false
   */
  strict?: boolean;
  /**
   * Relative output path to export JSON audit report (e.g., `'build-score.json'`).
   */
  jsonReportPath?: string;
  /**
   * Alias for `jsonReportPath`.
   */
  reportFile?: string;
  /**
   * Print ANSI build health report and performance summary in terminal on build completion.
   * @default true
   */
  verbose?: boolean;
}

export interface ExtensionMetric {
  count: number;
  totalMs: number;
}

export interface SlowFileRecord {
  id: string;
  durationMs: number;
}

export interface ScoreCategory {
  name: string;
  score: number;
  maxScore: number;
  details: string[];
}

export interface BuildScoreReport {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  categories: Record<string, ScoreCategory>;
  recommendations: string[];
  performanceMetrics?: {
    totalBuildTimeMs: number;
    transformedModuleCount: number;
    metricsByExtension: Record<string, { count: number; totalMs: number }>;
    slowFiles: SlowFileRecord[];
  };
  generatedAt: string;
}

function parseBytes(size?: string | number): number | undefined {
  if (size === undefined || size === null) return undefined;
  if (typeof size === 'number') return size;

  const str = size.trim().toLowerCase();
  const match = str.match(/^([\d.]+)\s*([a-z]*)$/);
  if (!match) return undefined;

  const num = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'b': return num;
    case 'kb': case 'k': return num * 1024;
    case 'mb': case 'm': return num * 1024 * 1024;
    case 'gb': case 'g': return num * 1024 * 1024 * 1024;
    default: return num;
  }
}

function calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'F' {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'F';
}

/**
 * Unified Vite plugin to audit production build quality, track module transform performance speeds,
 * calculate a 0-100 Project Health Score with letter grades (A+, A, B, C, F), and output optimization recommendations.
 *
 * @param options Configuration options for size budgets, slow transform thresholds, passing grades, and JSON report export.
 * @returns A Vite Plugin object.
 */
export default function buildScorerPlugin(options: BuildScorerOptions = {}): Plugin {
  const parsedChunkBytes = parseBytes(options.maxChunkSize);
  const maxChunkKb = parsedChunkBytes ? parsedChunkBytes / 1024 : (options.maxChunkSizeKb ?? 500);

  const parsedTotalBytes = parseBytes(options.maxTotalSize);
  const maxTotalMb = parsedTotalBytes ? parsedTotalBytes / (1024 * 1024) : (options.maxTotalBundleMb ?? 5);

  const parsedAssetBytes = parseBytes(options.maxAssetSize) ?? 1024 * 1024;

  const slowThreshold = options.slowTransformThresholdMs ?? 500;
  const topSlowCount = options.topSlowFilesCount ?? 5;
  const trackPerf = options.trackPerformance !== false;
  const minScoreToPass = options.minScoreToPass ?? 70;
  const isStrict = options.strict === true;
  const verbose = options.verbose !== false;
  const jsonReportPath = options.jsonReportPath || options.reportFile;

  let resolvedConfig: ResolvedConfig;
  let startTime = 0;
  let transformedFileCount = 0;
  let totalTransformTime = 0;

  const metricsByExt = new Map<string, ExtensionMetric>();
  const slowFiles: SlowFileRecord[] = [];

  let reportData: BuildScoreReport | null = null;

  return {
    name: 'vite-plugin-build-scorer',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    buildStart() {
      startTime = performance.now();
      transformedFileCount = 0;
      totalTransformTime = 0;
      metricsByExt.clear();
      slowFiles.length = 0;
    },
    transform(_code, id) {
      if (!trackPerf) return null;
      const start = performance.now();
      const durationMs = performance.now() - start;

      transformedFileCount++;
      totalTransformTime += durationMs;

      const ext = path.extname(id.split('?')[0]) || '.other';
      const metric = metricsByExt.get(ext) || { count: 0, totalMs: 0 };
      metric.count++;
      metric.totalMs += durationMs;
      metricsByExt.set(ext, metric);

      if (durationMs >= slowThreshold) {
        slowFiles.push({ id, durationMs });
      }

      return null;
    },
    generateBundle(_opts, bundle) {
      const buildDurationMs = performance.now() - startTime;
      const recommendations: string[] = [];

      // Category 1: Bundle Health (Max 30 pts)
      let bundleHealthScore = 30;
      const bundleDetails: string[] = [];
      let totalSizeBytes = 0;
      let jsChunkCount = 0;
      let oversizedChunksCount = 0;

      for (const [fileName, fileMeta] of Object.entries(bundle)) {
        let size = 0;
        if (fileMeta.type === 'chunk') {
          size = Buffer.byteLength(fileMeta.code, 'utf8');
          jsChunkCount++;
          const sizeKb = size / 1024;
          if (sizeKb > maxChunkKb) {
            oversizedChunksCount++;
            bundleHealthScore -= 5;
            recommendations.push(
              `JS chunk "${fileName}" (${sizeKb.toFixed(1)} KB) exceeds ${maxChunkKb} KB threshold. Consider code splitting.`
            );
          }
        } else if (fileMeta.type === 'asset') {
          size = typeof fileMeta.source === 'string'
            ? Buffer.byteLength(fileMeta.source, 'utf8')
            : fileMeta.source.byteLength;
        }
        totalSizeBytes += size;
      }

      const totalMb = totalSizeBytes / (1024 * 1024);
      if (totalMb > maxTotalMb) {
        bundleHealthScore -= 10;
        recommendations.push(
          `Total dist bundle size (${totalMb.toFixed(2)} MB) exceeds ${maxTotalMb} MB threshold.`
        );
      }

      if (jsChunkCount > 1) {
        bundleDetails.push(`Split into ${jsChunkCount} JS chunks`);
      } else {
        bundleDetails.push(`Single bundle file without vendor code splitting`);
        recommendations.push(`Use vendor chunk splitting to improve browser caching.`);
      }

      bundleHealthScore = Math.max(0, Math.min(30, bundleHealthScore));

      // Category 2: Asset Optimization (Max 25 pts)
      let assetScore = 25;
      const assetDetails: string[] = [];
      let oversizedAssetsCount = 0;

      for (const [fileName, fileMeta] of Object.entries(bundle)) {
        if (fileMeta.type === 'asset') {
          const size = typeof fileMeta.source === 'string'
            ? Buffer.byteLength(fileMeta.source, 'utf8')
            : fileMeta.source.byteLength;

          if (size > parsedAssetBytes) {
            oversizedAssetsCount++;
            assetScore -= 5;
            recommendations.push(
              `Large static asset "${fileName}" (${(size / (1024 * 1024)).toFixed(2)} MB). Consider CDN or image compression.`
            );
          }
        }
      }

      assetDetails.push(`${oversizedAssetsCount === 0 ? 'All assets within budget limits' : `${oversizedAssetsCount} oversized asset(s)`}`);
      assetScore = Math.max(0, Math.min(25, assetScore));

      // Category 3: Build Speed & Throughput (Max 20 pts)
      let speedScore = 20;
      const buildSec = buildDurationMs / 1000;
      if (buildSec > 30) {
        speedScore -= 10;
        recommendations.push(`Build took ${buildSec.toFixed(1)}s. Audit slow transforms with transform thresholds.`);
      } else if (buildSec > 10) {
        speedScore -= 5;
      }
      speedScore = Math.max(0, Math.min(20, speedScore));

      // Category 4: Production Preparedness (Max 25 pts)
      let prodScore = 25;
      const prodDetails: string[] = [];

      if (resolvedConfig.build.minify === false) {
        prodScore -= 10;
        prodDetails.push('Minification is DISABLED');
        recommendations.push('Enable build minification (`build.minify: true`) for production releases.');
      } else {
        prodDetails.push(`Minification enabled (${resolvedConfig.build.minify})`);
      }

      if (resolvedConfig.build.sourcemap === true) {
        prodScore -= 5;
        prodDetails.push('Public source maps included');
        recommendations.push('Set `build.sourcemap: "hidden"` or `false` to avoid leaking source code in production.');
      } else {
        prodDetails.push('Source maps safe / optimized');
      }

      prodScore = Math.max(0, Math.min(25, prodScore));

      // Calculate Total Score & Grade
      const totalScore = bundleHealthScore + assetScore + speedScore + prodScore;
      const grade = calculateGrade(totalScore);

      const perfMetricsObj: Record<string, { count: number; totalMs: number }> = {};
      for (const [ext, data] of metricsByExt.entries()) {
        perfMetricsObj[ext] = data;
      }

      reportData = {
        score: totalScore,
        grade,
        categories: {
          bundleHealth: { name: 'Bundle Health', score: bundleHealthScore, maxScore: 30, details: bundleDetails },
          assetOptimization: { name: 'Asset Optimization', score: assetScore, maxScore: 25, details: assetDetails },
          buildSpeed: { name: 'Build Speed', score: speedScore, maxScore: 20, details: [`Completed in ${buildSec.toFixed(2)}s`] },
          productionPreparedness: { name: 'Production Readiness', score: prodScore, maxScore: 25, details: prodDetails },
        },
        recommendations,
        performanceMetrics: {
          totalBuildTimeMs: Math.round(buildDurationMs),
          transformedModuleCount: transformedFileCount,
          metricsByExtension: perfMetricsObj,
          slowFiles,
        },
        generatedAt: new Date().toISOString(),
      };

      // Write JSON Report File
      if (jsonReportPath) {
        try {
          const outDir = resolvedConfig.build.outDir || 'dist';
          const targetFile = path.resolve(outDir, jsonReportPath);
          const dir = path.dirname(targetFile);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(targetFile, JSON.stringify(reportData, null, 2), 'utf8');
          logStep('scorer', '[SUCCESS]', `Exported build health score JSON report to ${path.relative(process.cwd(), targetFile)}`);
        } catch (err: any) {
          logStep('scorer', '[WARNING]', `Failed to export JSON report: ${err.message}`);
        }
      }

      // Strict enforcement check
      if (isStrict && totalScore < minScoreToPass) {
        throw new Error(
          `[buildScorerPlugin] Build score failed quality gate (${totalScore}/100 < minimum required ${minScoreToPass}). Grade: ${grade}.`
        );
      }
    },
    closeBundle() {
      if (!verbose || !reportData) return;

      const totalBuildTime = reportData.performanceMetrics?.totalBuildTimeMs || Math.round(performance.now() - startTime);
      const gradeColored = reportData.grade === 'A+' || reportData.grade === 'A'
        ? colors.green(reportData.grade)
        : reportData.grade === 'B'
        ? colors.cyan(reportData.grade)
        : reportData.grade === 'C'
        ? colors.yellow(reportData.grade)
        : colors.red(reportData.grade);

      const summaryLines: string[] = [
        `Overall Score : ${colors.green(`${reportData.score} / 100`)} (Grade: ${gradeColored})`,
        `Build Time    : ${colors.cyan(`${totalBuildTime}ms`)} (${transformedFileCount} modules transformed)`,
        '',
        `${colors.cyan('Category Breakdown:')}`,
        `  Bundle Health      : ${reportData.categories.bundleHealth.score} / 30 pts`,
        `  Asset Optimization : ${reportData.categories.assetOptimization.score} / 25 pts`,
        `  Build Speed        : ${reportData.categories.buildSpeed.score} / 20 pts`,
        `  Production Ready   : ${reportData.categories.productionPreparedness.score} / 25 pts`,
      ];

      if (metricsByExt.size > 0) {
        summaryLines.push('');
        summaryLines.push(colors.cyan('Module Transform Performance:'));
        for (const [ext, data] of metricsByExt.entries()) {
          summaryLines.push(`  ${ext.padEnd(8)} : ${String(data.count).padStart(4)} files`);
        }
      }

      if (slowFiles.length > 0) {
        summaryLines.push('');
        summaryLines.push(colors.yellow(`Slow Transforms (> ${slowThreshold}ms):`));
        slowFiles.slice(0, topSlowCount).forEach((sf) => {
          summaryLines.push(`  ${colors.yellow(`${sf.durationMs.toFixed(1)}ms`)} - ${path.relative(process.cwd(), sf.id)}`);
        });
      }

      if (reportData.recommendations.length > 0) {
        summaryLines.push('');
        summaryLines.push(`${colors.yellow('Optimization Recommendations:')}`);
        reportData.recommendations.forEach((rec, idx) => {
          summaryLines.push(`  ${idx + 1}. ${rec}`);
        });
      }

      logBox(`Vite Project Build Quality & Performance Summary: ${reportData.score}/100 [Grade ${reportData.grade}]`, 'info');
      console.log(summaryLines.join('\n'));
      logStep('scorer', '[SUCCESS]', `Build quality and performance audit completed in ${totalBuildTime}ms.`);
    },
  };
}
