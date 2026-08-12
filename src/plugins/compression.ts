import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { Plugin, ResolvedConfig } from 'vite';
import { logBox, logStep } from '../utils/logger';

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

function getFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

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

  return {
    name: 'vite-plugin-compression',
    apply: 'build',
    configResolved(config) {
      viteConfig = config;
    },
    async closeBundle() {
      if (!viteConfig) return;
      const outDir = path.resolve(viteConfig.root || process.cwd(), viteConfig.build.outDir || 'dist');
      const files = getFiles(outDir);

      let compressedCount = 0;

      for (const filePath of files) {
        if (filePath.endsWith('.gz') || filePath.endsWith('.br')) continue;
        const ext = path.extname(filePath).toLowerCase();
        if (!extensions.includes(ext)) continue;

        const stat = fs.statSync(filePath);
        if (stat.size < threshold) continue;

        const content = fs.readFileSync(filePath);

        if (algorithm === 'gzip' || algorithm === 'both') {
          const gzipped = zlib.gzipSync(content, { level: zlib.constants.Z_BEST_COMPRESSION });
          fs.writeFileSync(`${filePath}.gz`, gzipped);
        }

        if (algorithm === 'brotli' || algorithm === 'both') {
          const brotlied = zlib.brotliCompressSync(content, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
            },
          });
          fs.writeFileSync(`${filePath}.br`, brotlied);
        }

        compressedCount++;
        if (verbose) {
          const relPath = path.relative(outDir, filePath);
          const parts: string[] = [];
          if ((algorithm === 'gzip' || algorithm === 'both') && fs.existsSync(`${filePath}.gz`)) {
            const gzSize = (fs.statSync(`${filePath}.gz`).size / 1024).toFixed(2);
            parts.push(`${gzSize} KB (gz)`);
          }
          if ((algorithm === 'brotli' || algorithm === 'both') && fs.existsSync(`${filePath}.br`)) {
            const brSize = (fs.statSync(`${filePath}.br`).size / 1024).toFixed(2);
            parts.push(`${brSize} KB (br)`);
          }
          logStep('compress', '[SUCCESS]', relPath, '→', parts.join(' | '));
        }

        if (deleteOrigin) {
          fs.unlinkSync(filePath);
        }
      }

      if (compressedCount > 0 && verbose) {
        logBox(`Pre-compressed ${compressedCount} static asset(s) with ${algorithm.toUpperCase()}`, 'success');
      }
    },
  };
}
