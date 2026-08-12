import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface SvgSpriteOptions {
  /**
   * Directory containing standalone SVG icon files.
   * Defaults to searching 'src/assets/icons' or 'src/icons'.
   */
  iconDir?: string;
  /**
   * Output SVG sprite file path relative to build assets directory.
   * @default 'assets/sprite.svg'
   */
  spriteFileName?: string;
  /**
   * Prefix applied to symbol IDs (e.g., 'icon-' produces `<symbol id="icon-search">`).
   * @default 'icon-'
   */
  symbolIdPrefix?: string;
  /**
   * Automatically inject inline hidden SVG sprite sheet into index.html body.
   * @default false
   */
  injectToHtml?: boolean;
  /**
   * Custom virtual module ID for importing SVG sprite helper script in JS/TS.
   * @default 'virtual:svg-sprite'
   */
  virtualModuleId?: string;
}

function cleanSvgContent(svgRaw: string, symbolId: string): { symbol: string; viewBox: string } {
  // Strip XML prolog, doctype, and comments
  let cleaned = svgRaw
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // Extract viewBox attribute
  const viewBoxMatch = cleaned.match(/viewBox=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  // Strip outer <svg> and </svg> tags
  cleaned = cleaned.replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '');

  const symbol = `<symbol id="${symbolId}" viewBox="${viewBox}">${cleaned.trim()}</symbol>`;
  return { symbol, viewBox };
}

/**
 * Vite plugin to combine individual SVG icons into an optimized SVG sprite sheet (`sprite.svg`),
 * supporting virtual module imports (`virtual:svg-sprite`) and automatic HTML body injection.
 *
 * @param options Configuration options for icon directories, symbol ID prefixes, and virtual module name.
 * @returns Vite Plugin instance.
 */
export default function svgSpritePlugin(options: SvgSpriteOptions = {}): Plugin {
  const symbolPrefix = options.symbolIdPrefix ?? 'icon-';
  const spriteFileName = options.spriteFileName || 'assets/sprite.svg';
  const virtualModuleId = options.virtualModuleId || 'virtual:svg-sprite';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  let rootDir = process.cwd();
  let iconsPath = '';
  let spriteContent = '';
  const iconIds: string[] = [];

  const compileSprite = (): string => {
    iconIds.length = 0;
    const targetDir = options.iconDir
      ? path.resolve(rootDir, options.iconDir)
      : [path.resolve(rootDir, 'src/assets/icons'), path.resolve(rootDir, 'src/icons')].find(fs.existsSync) || '';

    if (!targetDir || !fs.existsSync(targetDir)) {
      return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none;"><defs></defs></svg>`;
    }

    iconsPath = targetDir;
    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.svg'));
    const symbols: string[] = [];

    for (const file of files) {
      const name = path.basename(file, '.svg');
      const symbolId = `${symbolPrefix}${name}`;
      const filePath = path.join(targetDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');

      const { symbol } = cleanSvgContent(raw, symbolId);
      symbols.push(symbol);
      iconIds.push(symbolId);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none;"><defs>${symbols.join('')}</defs></svg>`;
  };

  return {
    name: 'vite-plugin-svg-sprite',
    configResolved(config) {
      rootDir = config.root || process.cwd();
      spriteContent = compileSprite();
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return null;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `
          export const iconIds = ${JSON.stringify(iconIds)};
          export const spriteFileName = ${JSON.stringify(spriteFileName)};
          export function getIconHref(iconName) {
            const id = iconName.startsWith('${symbolPrefix}') ? iconName : '${symbolPrefix}' + iconName;
            return '#' + id;
          }
          export default { iconIds, spriteFileName, getIconHref };
        `;
      }
      return null;
    },
    configureServer(server) {
      if (!iconsPath) return;
      server.watcher.add(iconsPath);
      server.watcher.on('change', (file) => {
        if (file.startsWith(iconsPath) && file.endsWith('.svg')) {
          spriteContent = compileSprite();
          const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: 'full-reload' });
          }
        }
      });
    },
    generateBundle() {
      if (spriteContent) {
        this.emitFile({
          type: 'asset',
          fileName: spriteFileName,
          source: spriteContent,
        });
      }
    },
    transformIndexHtml(html) {
      if (options.injectToHtml && spriteContent) {
        return html.replace('<body>', `<body>\n    ${spriteContent}`);
      }
      return html;
    },
  };
}
