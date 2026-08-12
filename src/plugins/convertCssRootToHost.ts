import type { Plugin } from 'vite';

const THEME_PATTERN = /(?:\.theme-[\w-]+)\s*\{/g;

/**
 * Options for the convertCssRootToHostPlugin.
 */
export interface ConvertCssRootToHostOptions {
  /**
   * Class prefix used for scoping theme classes inside `:host(...)`.
   * @default '.theme-'
   */
  themePrefix?: string;
}

/**
 * Vite plugin to convert `:root` and Tailwind CSS selectors to `:host` in processed CSS files post-transform.
 *
 * @param options - Optional configuration options for theme class scoping.
 * @returns A Vite Plugin object.
 */
export default function convertCssRootToHostPlugin(options: ConvertCssRootToHostOptions = {}): Plugin {
  const prefix = options.themePrefix || '.theme-';
  const themePattern = prefix === '.theme-'
    ? THEME_PATTERN
    : new RegExp(`(?:${prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\w-]+)\\s*\\{`, 'g');

  return {
    name: 'convert-css-root-to-host',
    enforce: 'post',
    transform: {
      filter: {
        id: [/\.css/, /type=style/],
      },
      handler(code: string) {
        if (!code.includes(':root') && !code.includes(prefix)) return null;

        let updatedCode = code;

        // 1. Convert any remaining standalone instances of :root to :host
        if (updatedCode.includes(':root')) {
          updatedCode = updatedCode.replaceAll(':root', ':host');
        }

        // 2. Handle theme classes safely inside Shadow DOM if they exist (e.g., .theme-default -> :host(.theme-default))
        if (updatedCode.includes(prefix)) {
          updatedCode = updatedCode.replace(themePattern, match => {
            const className = match.slice(0, match.length - 1).trim();
            return `:host(${className}) {`;
          });
        }

        return {
          code: updatedCode,
          map: null,
        };
      },
    },
  };
}
