import { transformWithEsbuild, type Plugin } from 'vite';

/**
 * Options for the jsAsJsxPlugin.
 */
export interface JsAsJsxOptions {}

const JSX_REGEX = /<([A-Za-z]|Fragment|\>)/;

function containsJSX(code: string): boolean {
  if (!code.includes('<')) return false;
  return JSX_REGEX.test(code);
}

/**
 * Vite plugin that enables writing JSX syntax inside standard `.js` and `.ts` files without requiring `.jsx` or `.tsx` file extensions.
 *
 * @returns A Vite Plugin object.
 */
export default function jsAsJsxPlugin(_options: JsAsJsxOptions = {}): Plugin {
  const includeList = [/\.(js|ts)$/];
  const excludeList = [/[\\/]node_modules[\\/]/];

  return {
    name: 'vite-plugin-js-as-jsx',
    enforce: 'pre',
    transform: {
      filter: {
        id: {
          include: includeList,
          exclude: excludeList,
        },
      },
      async handler(code: string, id: string) {
        if (!containsJSX(code)) return null;
        const lang = id.endsWith('.ts') ? 'tsx' : 'jsx';
        const vite = await import('vite');
        if (typeof (vite as any).transformWithOxc === 'function') {
          return await (vite as any).transformWithOxc(code, id, { lang });
        }
        const loader = lang === 'tsx' ? 'tsx' : 'jsx';
        return await transformWithEsbuild(code, id, { loader });
      },
    },
    config(config) {
      const configAny = config as any;
      configAny.oxc = configAny.oxc || {};
      configAny.oxc.jsx = { runtime: 'automatic' };

      config.build = config.build || {};
      configAny.build.rolldownOptions = configAny.build.rolldownOptions || {};
      configAny.build.rolldownOptions.moduleTypes = configAny.build.rolldownOptions.moduleTypes || {};
      configAny.build.rolldownOptions.moduleTypes['.js'] = 'jsx';
      configAny.build.rolldownOptions.moduleTypes['.ts'] = 'tsx';

      config.optimizeDeps = config.optimizeDeps || {};
      configAny.optimizeDeps.rolldownOptions = configAny.optimizeDeps.rolldownOptions || {};
      configAny.optimizeDeps.rolldownOptions.moduleTypes = configAny.optimizeDeps.rolldownOptions.moduleTypes || {};
      configAny.optimizeDeps.rolldownOptions.moduleTypes['.js'] = 'jsx';
      configAny.optimizeDeps.rolldownOptions.moduleTypes['.ts'] = 'tsx';
    },
  };
}
