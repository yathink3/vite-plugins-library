import type { Plugin, Alias } from 'vite';
import fs from 'fs';
import path from 'path';
import { logStep } from '../utils/logger';

/**
 * Options for the autoAliasPlugin.
 */
export interface AutoAliasOptions {
  /**
   * Path to tsconfig.json or jsconfig.json relative to project root.
   * @default 'tsconfig.json'
   */
  tsconfigPath?: string;
  /**
   * Whether to automatically create `@<folder>` aliases for top-level subdirectories inside `srcDir`.
   * @default true
   */
  autoMapSrcFolders?: boolean;
  /**
   * Source code directory relative to project root.
   * @default 'src'
   */
  srcDir?: string;
  /**
   * Alias prefix used when auto-mapping `srcDir` subdirectories.
   * @default '@'
   */
  prefix?: string;
  /**
   * Additional custom aliases to append or override.
   */
  customAliases?: Record<string, string>;
  /**
   * List of npm package names to deduplicate during module resolution (e.g. `['react', 'react-dom']`).
   */
  dedupePackages?: string[];
}

/**
 * Removes simple JSON comments from tsconfig/jsconfig content before parsing.
 */
function stripJsonComments(jsonString: string): string {
  return jsonString
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

/**
 * Vite plugin that automatically resolves path aliases from `tsconfig.json` or `jsconfig.json`
 * and maps subdirectories inside `src/` to `@` path aliases.
 *
 * @param options - Configuration options for tsconfig location, src mapping, and custom aliases.
 * @returns A Vite Plugin object.
 */
export default function autoAliasPlugin(options: AutoAliasOptions = {}): Plugin {
  const tsconfigPath = options.tsconfigPath || 'tsconfig.json';
  const autoMapSrcFolders = options.autoMapSrcFolders !== false;
  const srcDir = options.srcDir || 'src';
  const prefix = options.prefix ?? '@';
  const customAliases = options.customAliases || {};

  return {
    name: 'vite-plugin-auto-alias',
    config(config, env) {
      const root = config.root ? path.resolve(config.root) : process.cwd();
      const resolvedAliases: Alias[] = [];

      // 1. Process customAliases
      for (const [find, replacement] of Object.entries(customAliases)) {
        const absReplacement = path.isAbsolute(replacement) ? replacement : path.resolve(root, replacement);
        resolvedAliases.push({ find, replacement: absReplacement });
      }

      // 2. Parse tsconfig.json or jsconfig.json paths
      const fullTsconfigPath = path.resolve(root, tsconfigPath);
      let baseUrl = root;

      if (fs.existsSync(fullTsconfigPath)) {
        try {
          const rawContent = fs.readFileSync(fullTsconfigPath, 'utf8');
          const cleanedContent = stripJsonComments(rawContent);
          const parsed = JSON.parse(cleanedContent);
          const compilerOptions = parsed.compilerOptions || {};

          if (compilerOptions.baseUrl) {
            baseUrl = path.resolve(root, compilerOptions.baseUrl);
          }

          if (compilerOptions.paths) {
            for (const [key, targets] of Object.entries<string[]>(compilerOptions.paths)) {
              if (!Array.isArray(targets) || targets.length === 0) continue;
              const cleanFind = key.replace(/\/\*$/, '');
              const cleanTarget = targets[0].replace(/\/\*$/, '');
              const absTarget = path.resolve(baseUrl, cleanTarget);

              if (!resolvedAliases.some(a => a.find === cleanFind)) {
                resolvedAliases.push({ find: cleanFind, replacement: absTarget });
              }
            }
          }
        } catch (err: any) {
          logStep('alias', '[WARNING]', `Failed to parse ${tsconfigPath}: ${err.message}`);
        }
      }

      // 3. Auto-map subfolders in srcDir if enabled
      const absSrcDir = path.resolve(root, srcDir);
      if (autoMapSrcFolders && fs.existsSync(absSrcDir)) {
        try {
          const entries = fs.readdirSync(absSrcDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const targetPath = path.join(absSrcDir, entry.name);

              // Direct subfolder alias (e.g. 'utils' -> '/src/utils', 'components' -> '/src/components')
              if (!resolvedAliases.some(a => a.find === entry.name)) {
                resolvedAliases.push({ find: entry.name, replacement: targetPath });
              }

              // Prefixed subfolder alias (e.g. '@utils' -> '/src/utils')
              if (prefix && prefix !== '') {
                const aliasName = `${prefix}${entry.name}`;
                if (!resolvedAliases.some(a => a.find === aliasName)) {
                  resolvedAliases.push({ find: aliasName, replacement: targetPath });
                }
              }
            }
          }

          // Default root alias (e.g. '@' -> src and 'src' -> src)
          const rootAlias = prefix || '@';
          if (!resolvedAliases.some(a => a.find === rootAlias)) {
            resolvedAliases.push({ find: rootAlias, replacement: absSrcDir });
          }
          if (!resolvedAliases.some(a => a.find === 'src')) {
            resolvedAliases.push({ find: 'src', replacement: absSrcDir });
          }
        } catch (err: any) {
          logStep('alias', '[WARNING]', `Failed to read ${srcDir} directory: ${err.message}`);
        }
      }

      logStep('alias', '[SUCCESS]', `Resolved ${resolvedAliases.length} path aliases`);

      config.resolve = config.resolve || {};

      if (options.dedupePackages && options.dedupePackages.length > 0) {
        config.resolve.dedupe = Array.from(new Set([...(config.resolve.dedupe || []), ...options.dedupePackages]));
      }

      const existingAliases = config.resolve.alias;

      if (Array.isArray(existingAliases)) {
        (config.resolve as any).alias = [...existingAliases, ...resolvedAliases];
      } else if (existingAliases && typeof existingAliases === 'object') {
        const objectAliases: Record<string, string> = { ...(existingAliases as Record<string, string>) };
        for (const alias of resolvedAliases) {
          if (typeof alias.find === 'string' && !(alias.find in objectAliases)) {
            objectAliases[alias.find] = alias.replacement;
          }
        }
        (config.resolve as any).alias = objectAliases;
      } else {
        (config.resolve as any).alias = resolvedAliases;
      }
    },
  };
}
