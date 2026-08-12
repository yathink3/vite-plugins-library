import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { colors, logBox, logStep } from '../utils/logger';

export interface BuildScorerOptions {
  /**
   * Maximum recommended single JS chunk size in KB before point deduction.
   * @default 500
   */
  maxChunkSizeKb?: number;
  /**
   * Target maximum total bundle size in MB before point deduction.
   * @default 5
   */
  maxTotalBundleMb?: number;
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
   * Relative output path to export JSON audit report (e.g., 'build-score.json').
   */
  jsonReportPath?: string;
  /**
   * Print ANSI build health report in terminal on build completion.
   * @default true
   */
  verbose?: boolean;
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
  generatedAt: string;
}

function calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'F' {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'F';
}

/**
 * Vite plugin to audit production build quality, calculate a 0-100 Project Health Score with letter grades (A+, A, B, C, F),
 * and output optimization recommendations and JSON report files.
 *
 * @param options Configuration options for size thresholds, passing grades, and JSON report export.
 * @returns Vite Plugin instance.
 */
export default function buildScorerPlugin(options: BuildScorerOptions = {}): Plugin {
  const maxChunkKb = options.maxChunkSizeKb ?? 500;
  const maxTotalMb = options.maxTotalBundleMb ?? 5;
  const minScoreToPass = options.minScoreToPass ?? 70;
  const isStrict = options.strict === true;
  const verbose = options.verbose !== false;

  let resolvedConfig: ResolvedConfig;
  let startTime = 0;

  return {
    name: 'vite-plugin-build-scorer',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    buildStart() {
      startTime = performance.now();
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

          if (size > 1024 * 1024) {
            oversizedAssetsCount++;
            assetScore -= 5;
            recommendations.push(`Large static asset "${fileName}" (${(size / (1024 * 1024)).toFixed(2)} MB). Consider CDN or image compression.`);
          }
        }
      }

      assetDetails.push(`${oversizedAssetsCount === 0 ? 'All assets within 1 MB limit' : `${oversizedAssetsCount} oversized asset(s)`}`);
      assetScore = Math.max(0, Math.min(25, assetScore));

      // Category 3: Build Speed & Throughput (Max 20 pts)
      let speedScore = 20;
      const buildSec = buildDurationMs / 1000;
      if (buildSec > 30) {
        speedScore -= 10;
        recommendations.push(`Build took ${buildSec.toFixed(1)}s. Audit slow transforms with buildPerformancePlugin.`);
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

      const report: BuildScoreReport = {
        score: totalScore,
        grade,
        categories: {
          bundleHealth: { name: 'Bundle Health', score: bundleHealthScore, maxScore: 30, details: bundleDetails },
          assetOptimization: { name: 'Asset Optimization', score: assetScore, maxScore: 25, details: assetDetails },
          buildSpeed: { name: 'Build Speed', score: speedScore, maxScore: 20, details: [`Completed in ${buildSec.toFixed(2)}s`] },
          productionPreparedness: { name: 'Production Readiness', score: prodScore, maxScore: 25, details: prodDetails },
        },
        recommendations,
        generatedAt: new Date().toISOString(),
      };

      if (verbose) {
        const gradeColored = grade === 'A+' || grade === 'A'
          ? colors.green(grade)
          : grade === 'B'
          ? colors.cyan(grade)
          : grade === 'C'
          ? colors.yellow(grade)
          : colors.red(grade);

        const summaryLines: string[] = [
          `Overall Score : ${colors.green(`${totalScore} / 100`)} (Grade: ${gradeColored})`,
          `Total Dist    : ${totalMb.toFixed(2)} MB across ${Object.keys(bundle).length} files`,
          '',
          `${colors.cyan('Category Breakdown:')}`,
          `  Bundle Health      : ${bundleHealthScore} / 30 pts`,
          `  Asset Optimization : ${assetScore} / 25 pts`,
          `  Build Speed        : ${speedScore} / 20 pts`,
          `  Production Ready   : ${prodScore} / 25 pts`,
        ];

        if (recommendations.length > 0) {
          summaryLines.push('');
          summaryLines.push(`${colors.yellow('Optimization Recommendations:')}`);
          recommendations.forEach((rec, idx) => {
            summaryLines.push(`  ${idx + 1}. ${rec}`);
          });
        }

        logBox(`Vite Project Build Quality Score: ${totalScore}/100 [Grade ${grade}]`, 'info');
        console.log(summaryLines.join('\n'));
      }

      // Write JSON Report File
      if (options.jsonReportPath) {
        try {
          const outDir = resolvedConfig.build.outDir || 'dist';
          const targetFile = path.resolve(outDir, options.jsonReportPath);
          const dir = path.dirname(targetFile);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(targetFile, JSON.stringify(report, null, 2), 'utf8');
          logStep('info', `Exported build health score JSON report to ${path.relative(process.cwd(), targetFile)}`);
        } catch (err: any) {
          logStep('warn', `Failed to export JSON report: ${err.message}`);
        }
      }

      // Strict enforcement check
      if (isStrict && totalScore < minScoreToPass) {
        throw new Error(
          `[buildScorerPlugin] Build score failed quality gate (${totalScore}/100 < minimum required ${minScoreToPass}). Grade: ${grade}.`
        );
      }
    },
  };
}
