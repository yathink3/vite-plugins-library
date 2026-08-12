import postcss, { type Root } from 'postcss';
import type { Plugin } from 'vite';

/**
 * Options for the postcssShadowDomTailwindPlugin.
 */
export interface PostcssShadowDomOptions {
  /**
   * Class prefix used for scoping theme classes inside `:host(...)`.
   * @default '.theme-'
   */
  themePrefix?: string;
  /**
   * Whether to convert `:root` selectors to `:host` for Web Component scoping.
   * @default true
   */
  convertRootToHost?: boolean;
  /**
   * Whether to remove existing CSS comments.
   * @default true
   */
  removeComments?: boolean;
  /**
   * Custom header comment string prepended to compiled output CSS. Set to `null` or `''` to omit.
   * @default '! tailwindcss v4+ shadow-dom'
   */
  headerComment?: string | null;
}

/**
 * Vite plugin that configures PostCSS to adapt Tailwind CSS v4+ & global styles for Web Components / Shadow DOM by converting `:root` to `:host`.
 *
 * @param options - Configuration options for theme prefix scoping, root-to-host conversion, and comment options.
 * @returns A Vite Plugin object.
 */
export default function postcssShadowDomTailwindPlugin(options: PostcssShadowDomOptions = {}): Plugin {
  const themePrefix = options.themePrefix || '.theme-';
  const shouldConvertRoot = options.convertRootToHost !== false;
  const shouldRemoveComments = options.removeComments !== false;
  const headerComment = options.headerComment !== undefined ? options.headerComment : '! tailwindcss v4+ shadow-dom';

  return {
    name: 'postcss-shadow-dom-tailwind-plugin',
    config(config) {
      config.css = config.css || {};

      if (!config.css.postcss || typeof config.css.postcss === 'string') {
        config.css.postcss = {};
      }

      const postcssObj = config.css.postcss as Extract<typeof config.css.postcss, object>;
      postcssObj.plugins = Array.isArray(postcssObj.plugins) ? postcssObj.plugins : [];

      postcssObj.plugins.push({
        postcssPlugin: 'postcss-shadow-dom-tailwind-fix',
        Once(root: Root) {
          const cssContent = root.source?.input?.css || '';
          const hasLayerProps = cssContent.includes('properties');
          const hasRoot = cssContent.includes(':root');
          const hasTheme = cssContent.includes(themePrefix);

          // 1. Target and replace complex nested fallback blocks
          if (hasLayerProps) {
            root.walkAtRules('layer', layerAtRule => {
              if (layerAtRule.params === 'properties') {
                layerAtRule.walkAtRules('supports', supportsAtRule => {
                  if (supportsAtRule.params.includes('-webkit-hyphens:none')) {
                    supportsAtRule.walkRules(rule => {
                      if (rule.selector.includes('*,:before,:after')) {
                        const cleanHostRule = postcss.rule({ selector: ':host' });
                        rule.nodes.forEach(node => cleanHostRule.append(node.clone()));
                        layerAtRule.parent?.insertBefore(layerAtRule, cleanHostRule);
                        layerAtRule.remove();
                      }
                    });
                  }
                });
              }
            });
          }

          // 2. Convert standard :root to :host, scope theme classes, and deduplicate selectors
          if (hasRoot || hasTheme) {
            root.walkRules(rule => {
              let selectors = rule.selectors;

              if (shouldConvertRoot && hasRoot && rule.selector.includes(':root')) {
                selectors = selectors.map(sel => sel.replaceAll(':root', ':host'));
              }

              if (hasTheme && rule.selector.includes(themePrefix)) {
                selectors = selectors.map(selector => {
                  const trimmed = selector.trim();
                  if (trimmed.startsWith(themePrefix)) return `:host(${trimmed})`;
                  return selector;
                });
              }

              // Deduplicate selectors to avoid generating ":host, :host"
              const uniqueSelectors = Array.from(new Set(selectors.map(s => s.trim())));
              rule.selectors = uniqueSelectors;
            });
          }

          // 3. Remove all existing comments if enabled
          if (shouldRemoveComments) {
            root.walkComments(comment => {
              comment.remove();
            });
          }

          // 4. Prepend header comment at beginning of CSS if provided
          if (headerComment) {
            root.prepend(
              postcss.comment({
                text: headerComment,
                raws: { left: '', right: ' ' },
              })
            );
          }
        },
      });
    },
  };
}
