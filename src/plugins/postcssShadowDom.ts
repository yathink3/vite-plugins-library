import postcss, { type Root } from 'postcss';
import type { Plugin } from 'vite';

export interface PostcssShadowDomOptions {
  themePrefix?: string;
  targetHost?: boolean;
  headerComment?: string;
  removeComments?: boolean;
}

/**
 * Vite plugin that configures PostCSS to adapt Tailwind CSS & global styles for Shadow DOM / Web Components.
 */
export default function postcssShadowDomPlugin(options: PostcssShadowDomOptions = {}): Plugin {
  const themePrefix = options.themePrefix || '.theme-';
  const removeComments = options.removeComments !== false;
  const headerComment = options.headerComment !== undefined
    ? options.headerComment
    : '! tailwindcss v4.3.0 shadow-dom';

  return {
    name: 'vite-plugin-postcss-shadow-dom',
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

              if (hasRoot && rule.selector.includes(':root')) {
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

          // 3. Remove all existing comments
          if (removeComments) {
            root.walkComments(comment => {
              comment.remove();
            });
          }

          // 4. Prepend header comment at beginning of CSS
          if (headerComment) {
            let cleanCommentText = headerComment.trim();
            if (cleanCommentText.startsWith('/*') && cleanCommentText.endsWith('*/')) {
              cleanCommentText = cleanCommentText.slice(2, -2).trim();
            }
            const raws = cleanCommentText.startsWith('!') ? { left: '', right: ' ' } : undefined;
            root.prepend(postcss.comment({ text: cleanCommentText, raws }));
          }
        },
      });
    },
  };
}
