import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { Plugin, ResolvedConfig } from 'vite';
import { logBox, logGrid, colors, createSpinner } from '../utils/logger';
const gzipAsync = (content: Buffer | string, options: zlib.ZlibOptions): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.gzip(content, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

const brotliCompressAsync = (content: Buffer | string, options: zlib.BrotliOptions): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.brotliCompress(content, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

/**
 * Options for the compressionPlugin.
 */
export interface CompressionPluginOptions {
  /**
   * Compression algorithm to execute (`'gzip'`, `'brotli'`, or `'both'`).
   * @default 'both'
   */
  algorithm?: 'gzip' | 'brotli' | 'both';
  /**
   * Minimum file size in bytes to trigger compression.
   * @default 1024 (1 KB)
   */
  threshold?: number;
  /**
   * File extensions to compress.
   * @default ['.js', '.css', '.html', '.svg', '.json', '.txt']
   */
  extensions?: string[];
  /**
   * Whether to delete original uncompressed source files after compression.
   * @default false
   */
  deleteOriginFile?: boolean;
  /**
   * Whether to print detailed compression status logs in terminal.
   * @default true
   */
  verbose?: boolean;
}

const DEFAULT_EXTENSIONS = ['.js', '.css', '.html', '.svg', '.json', '.txt'];

/**
 * Vite plugin for zero-dependency static Gzip and Brotli asset pre-compression using Node's native `zlib` module during production build.
 *
 * @param options - Configuration options for compression algorithm, file size threshold, and target file extensions.
 * @returns A Vite Plugin object.
 */
export default function compressionPlugin(options: CompressionPluginOptions = {}): Plugin {
  const algorithm = options.algorithm || 'both';
  const threshold = options.threshold ?? 1024;
  const extensions = options.extensions
    ? options.extensions.map(ext => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`))
    : DEFAULT_EXTENSIONS;
  const deleteOrigin = options.deleteOriginFile ?? false;
  const verbose = options.verbose !== false;

  let viteConfig: ResolvedConfig | undefined;
  let filesToCompress: { outDir: string; fileName: string }[] = [];

  return {
    name: 'vite-plugin-compression',
    apply: 'build',
    configResolved(config) {
      viteConfig = config;
    },
    writeBundle(outputOptions, bundle) {
      if (!viteConfig) return;
      const outDir = outputOptions.dir || path.resolve(viteConfig.root || process.cwd(), viteConfig.build.outDir || 'dist');
      for (const fileName of Object.keys(bundle)) {
        filesToCompress.push({ outDir, fileName });
      }
    },
    async closeBundle() {
      if (!viteConfig || filesToCompress.length === 0) return;

      let compressedCount = 0;

      const currentFiles = [...filesToCompress];
      filesToCompress = [];

      interface CompressResult {
        fileName: string;
        gzSize?: string;
        brSize?: string;
      }
      let spinner: ReturnType<typeof createSpinner> | null = null;
      if (verbose) {
        spinner = createSpinner(`Compressing assets with ${algorithm.toUpperCase()}`);
        spinner.start();
      }

      const compressTasks = currentFiles.map(async ({ outDir, fileName }) => {
        const filePath = path.resolve(outDir, fileName);

        if (!fs.existsSync(filePath)) return null;
        if (filePath.endsWith('.gz') || filePath.endsWith('.br')) return null;

        const ext = path.extname(filePath).toLowerCase();
        if (!extensions.includes(ext)) return null;

        const stat = await fs.promises.stat(filePath);
        if (stat.size < threshold) return null;

        if (spinner) spinner.update(`Compressing ${fileName}`);

        const content = await fs.promises.readFile(filePath);
        const tasks: Promise<void>[] = [];

        if (algorithm === 'gzip' || algorithm === 'both') {
          tasks.push(
            gzipAsync(content, { level: zlib.constants.Z_BEST_COMPRESSION })
              .then(gzipped => fs.promises.writeFile(`${filePath}.gz`, gzipped))
          );
        }

        if (algorithm === 'brotli' || algorithm === 'both') {
          tasks.push(
            brotliCompressAsync(content, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
              },
            }).then(brotlied => fs.promises.writeFile(`${filePath}.br`, brotlied))
          );
        }

        await Promise.all(tasks);

        let gzSize, brSize;
        if (verbose) {
          if ((algorithm === 'gzip' || algorithm === 'both') && fs.existsSync(`${filePath}.gz`)) {
            gzSize = (fs.statSync(`${filePath}.gz`).size / 1024).toFixed(2);
          }
          if ((algorithm === 'brotli' || algorithm === 'both') && fs.existsSync(`${filePath}.br`)) {
            brSize = (fs.statSync(`${filePath}.br`).size / 1024).toFixed(2);
          }
        }

        if (deleteOrigin) {
          await fs.promises.unlink(filePath);
        }

        return { fileName, gzSize, brSize };
      });

      const rawResults = await Promise.all(compressTasks);

      if (spinner) spinner.stop();

      const results: CompressResult[] = rawResults.filter(r => r !== null && (!!r.gzSize || !!r.brSize)) as CompressResult[];
      compressedCount = rawResults.filter(r => r !== null).length;

      if (verbose && results.length > 0) {
        const rows: string[][] = [];
        const hasGz = algorithm === 'gzip' || algorithm === 'both';
        const hasBr = algorithm === 'brotli' || algorithm === 'both';

        for (const r of results) {
          const row = [r.fileName, '→'];
          if (hasGz) row.push(r.gzSize ? `${r.gzSize} KB (gz)` : '');
          if (hasGz && hasBr) row.push(r.gzSize && r.brSize ? '|' : '');
          if (hasBr) row.push(r.brSize ? `${r.brSize} KB (br)` : '');
          rows.push(row);
        }

        const align: ('left' | 'right')[] = ['left', 'left'];
        if (hasGz) align.push('right');
        if (hasGz && hasBr) align.push('left');
        if (hasBr) align.push('right');
        logGrid('compress', rows, align);
      }

      if (compressedCount > 0 && verbose) {
        logBox(`Pre-compressed ${compressedCount} static asset(s) with ${algorithm.toUpperCase()}`, 'success');
      }
    },
  };
}
