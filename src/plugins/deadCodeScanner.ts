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
  /**
   * Enable debug logging to see which dynamic patterns were detected.
   * @default false
   */
  debug?: boolean;
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

const KNOWN_FILE_EXT = /\.(json|js|ts|jsx|tsx|mjs|cjs|vue|svelte|css|scss|sass|less|styl|png|jpg|jpeg|gif|svg|webp|ico|bmp|woff|woff2|ttf|eot|otf|mp3|wav|ogg|mp4|webm|pdf|txt|xml|yml|yaml|toml|csv|md)$/i;

function isLikelyAssetPath(raw: string): boolean {
  const hasExt = KNOWN_FILE_EXT.test(raw);
  const startsLikePath = /^(\/|\.\/|\.\.\/|public\/|src\/|assets\/|locales\/|images\/|fonts\/|static\/)/.test(raw);
  const hasSlashWithExt = raw.includes('/') && hasExt;
  const hasManySlashes = (raw.match(/\//g) || []).length >= 2;
  return (startsLikePath && hasExt) || hasSlashWithExt || (hasManySlashes && hasExt);
}

/**
 * Extracts path-like patterns that use variable interpolation.
 * Converts template literals and glob patterns to regex patterns.
 */
function extractDynamicPatterns(combinedText: string, debug: boolean = false): RegExp[] {
  const patterns: RegExp[] = [];
  const seen = new Set<string>();

  function addPattern(regexStr: string, source: string) {
    if (!regexStr || seen.has(regexStr)) return;
    seen.add(regexStr);
    try {
      const r = new RegExp(regexStr);
      patterns.push(r);
      if (debug) logStep('dead-code', '[PATTERN]', `${source}: ${r.toString()}`);
    } catch (_e) {
      // skip invalid regex
    }
  }

  function rawToEscaped(raw: string): string {
    return raw
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\$\\\{[^}]+\\\}/g, '[^/]+');
  }

  let match: RegExpExecArray | null;

  // ====== 1. Template literals: `/locales/${lang}/translation.json` ======
  const templateLiteralRegex = /`([^`]*\$\{[^}]+\}[^`]*)`/g;
  while ((match = templateLiteralRegex.exec(combinedText)) !== null) {
    const raw = match[1];
    if (!isLikelyAssetPath(raw)) continue;
    addPattern(rawToEscaped(raw), 'template-literal');
  }

  // ====== 2. import.meta.glob / globEager ======
  const importMetaGlobRegex = /import\.meta\.glob(?:Eager)?\(\s*['"]([^'"]+)['"]/g;
  while ((match = importMetaGlobRegex.exec(combinedText)) !== null) {
    const globPattern = match[1];
    const escaped = globPattern
      .replace(/\*\*/g, '\x00DOUBLESTAR\x00')
      .replace(/\*/g, '\x00STAR\x00')
      .replace(/[.+^${}()|[\]\\]/g, (c) => '\\' + c)
      .replace(/\x00DOUBLESTAR\x00/g, '.*')
      .replace(/\x00STAR\x00/g, '[^/]*');
    addPattern(escaped, 'import.meta.glob');
  }

  // ====== 3. require.context ======
  const requireContextRegex = /require\.context\(\s*['"]([^'"]+)['"]\s*,\s*(true|false)\s*,\s*\/([^/]+)\/\s*\)/g;
  while ((match = requireContextRegex.exec(combinedText)) !== null) {
    addPattern(match[3], 'require.context');
  }

  // ====== 4. String concatenation with `+`: '/locales/' + lang + '/translation.json' ======
  const concatStrRegex = /['"]([^'"]*\/[^'"]*)['"]\s*\+\s*[A-Za-z_$][\w$.]*\s*\+\s*['"]([^'"]*\/[^'"]*\.[^'"]+)['"]|['"]([^'"]*\/[^'"]*\.[^'"]*)['"]\s*\+\s*[A-Za-z_$][\w$.]*\s*\+\s*['"]([^'"]*\/[^'"]+)['"]/g;
  while ((match = concatStrRegex.exec(combinedText)) !== null) {
    const prefix = match[1] || match[4] || '';
    const suffix = match[2] || match[5] || '';
    const combined = prefix + '__VAR__' + suffix;
    if (isLikelyAssetPath(combined)) {
      const escaped = (prefix + '[^/]+' + suffix)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\[\\\^\\\/\\\]\+/g, '[^/]+');
      addPattern(escaped, 'string-concat');
    }
  }

  // ====== 5. String concat chained with multiple vars: '/a/' + x + '/' + y + '.json' ======
  const multiConcatRegex = /(?:'([^']*\/[^']*)'|"([^"]*\/[^"]*)")\s*\+\s*(?:[A-Za-z_$][\w$.]*|\([^)]+\))\s*\+\s*(?:'([^']*\/[^']*\.+[^']*)'|"([^"]*\/[^"]*\.+[^"]*)")/g;
  while ((match = multiConcatRegex.exec(combinedText)) !== null) {
    const prefix = (match[1] || match[2] || '');
    const suffix = (match[3] || match[4] || '');
    const combined = prefix + '__VAR__' + suffix;
    if (isLikelyAssetPath(combined)) {
      const escaped = (prefix + '[^/]+' + suffix)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\[\\\^\\\/\\\]\+/g, '[^/]+');
      addPattern(escaped, 'multi-string-concat');
    }
  }

  // ====== 6. i18next-style: {{lng}} / {{ns}} placeholder patterns in loadPath ======
  const i18nextPlaceholderRegex = /['"`]([^'"`]*?(?:\{\{[^}]+\}\})[^'"`]*?\.(?:json|mo|po))['"`]/g;
  while ((match = i18nextPlaceholderRegex.exec(combinedText)) !== null) {
    const raw = match[1];
    if (raw.includes('/')) {
      const escaped = raw
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\{\\\{[^}]+\\\}\\\}/g, '[^/]+');
      addPattern(escaped, 'i18next-placeholder');
    }
  }

  // ====== 7. Pattern: .map(lang => `/locales/${lang}/...`) or .forEach / .join with lang ======
  const arrayMapRegex = /\.(?:map|forEach|filter|flatMap)\s*\(\s*(?:\([^)]+\)|[A-Za-z_$][\w$]*)\s*(?:=>|->)\s*`([^`]*)`/g;
  while ((match = arrayMapRegex.exec(combinedText)) !== null) {
    const raw = match[1];
    if (!isLikelyAssetPath(raw)) continue;
    addPattern(rawToEscaped(raw), 'array-map-template');
  }

  // ====== 8. fetch()/axios with regular string concat (non-template) ======
  const fetchConcatRegex = /(?:fetch|axios\.get|axios\.post|axios\.put|axios\.delete|axios\.patch|axios|request|i18next|i18n)\(\s*([A-Za-z_$][\w$.]*\s*\+\s*)?['"`]([^'"`]*\/[^'"`]*\.[^'"`]+)['"`]\s*\+/g;
  while ((match = fetchConcatRegex.exec(combinedText)) !== null) {
    const urlPart = match[2];
    if (urlPart.includes('/')) {
      const basePath = urlPart.replace(/\/+$/, '');
      const escaped = basePath
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        + (/\/$/.test(basePath) ? '' : '/') + '[^/]+';
      addPattern(escaped + '.*', 'fetch-concat');
    }
  }

  // ====== 9. Array of language codes + common usage ======
  //   e.g. `['en','fr','de','ja','zh','ko','es','it','pt','ru','nl','pl','sv','tr','vi','th','cs','hu','ro','da','fi','no','sk','bg','hr','el','he','ar','hi','bn','ca','id','uk','te','kn','mr','gl','be','lv','nn']`
  //   If we see a long array of short codes, AND the word "locale" or "i18n" or "language" or "lang" appears nearby,
  //   assume locale loading and auto-add the locale pattern.
  const langArrayNearLocaleCtxRegex = /(locale|i18n|language|lang|translation|namespace|ns)[\s\S]{0,400}?\[\s*((?:'[a-z]{2,3}'|"[a-z]{2,3}")\s*,\s*){5,}(?:'[a-z]{2,3}'|"[a-z]{2,3}")\s*\]/i;
  if (langArrayNearLocaleCtxRegex.test(combinedText)) {
    addPattern('locales/[^/]+/translation\\.json', 'lang-array-context(A)');
    addPattern('locales/[^/]+/[^/]+\\.json', 'lang-array-context(B)');
    addPattern('/locales/[^/]+/translation\\.json', 'lang-array-context(C)');
    addPattern('/locales/[^/]+/[^/]+\\.json', 'lang-array-context(D)');
  }

  // ====== 10. Literal locale list embedded in code with fetch for each ======
  const localeDirectPattern = /['"]locales\/['"]/;
  if (localeDirectPattern.test(combinedText)) {
    addPattern('locales/[^/]+/.*', 'literal-locales-reference');
  }

  // ====== 11. Vite /\$\{.*?locale.*?\} style paths ======
  const localeVarConcatRegex = /(?:lang|locale|language)[\s\S]{0,200}?\/locales\//i;
  if (localeVarConcatRegex.test(combinedText)) {
    addPattern('/?locales/[^/]+/[^/]+\\.json', 'lang-var-context');
  }

  return patterns;
}

/**
 * Tests whether a file path matches any of the dynamically extracted patterns.
 */
function matchesDynamicPattern(filePath: string, patterns: RegExp[], targetDirs: string[] = ['public', 'src/assets']): boolean {
  if (patterns.length === 0) return false;
  const normalized = filePath.replace(/\\/g, '/');

  const variants = new Set<string>([normalized]);

  for (const dir of targetDirs) {
    const prefix = dir.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
    if (normalized.startsWith(prefix)) {
      const withoutPrefix = normalized.slice(prefix.length);
      variants.add(withoutPrefix);
      variants.add('/' + withoutPrefix);
    }
  }

  const parts = normalized.split('/');
  for (let i = 1; i < Math.min(parts.length, 5); i++) {
    const sub = parts.slice(i).join('/');
    variants.add(sub);
    variants.add('/' + sub);
    variants.add('./' + sub);
    variants.add('../' + sub);
  }

  for (let depth = 1; depth <= 3; depth++) {
    for (let i = depth; i < Math.min(parts.length, 5); i++) {
      const sub = parts.slice(i).join('/');
      const dots = Array(depth).fill('..').join('/');
      variants.add(dots + '/' + sub);
    }
  }

  for (const variant of variants) {
    for (const pattern of patterns) {
      if (pattern.test(variant)) {
        return true;
      }
    }
  }
  return false;
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
  const debug = options.debug === true;

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

      // 3. Extract dynamic patterns from code (template literals, glob patterns, etc.)
      const dynamicPatterns = extractDynamicPatterns(combinedText, debug);

      // 4. Check which files in targetDirs were never referenced
      const unusedFiles: string[] = [];

      for (const targetFile of allTargetFiles) {
        const relPathClean = targetFile.relativePath.replace(/\\/g, '/');
        const basename = targetFile.basename;

        const isReferencedLiteral = combinedText.includes(relPathClean) || combinedText.includes(basename);
        const isReferencedDynamic = matchesDynamicPattern(relPathClean, dynamicPatterns, targetDirs);
        const isReferenced = isReferencedLiteral || isReferencedDynamic;

        if (!isReferenced) {
          unusedFiles.push(relPathClean);
        }
      }

      if (unusedFiles.length > 0) {
        logStep('dead-code', '[WARNING]', `Found ${unusedFiles.length} unreferenced static asset(s):`);
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
