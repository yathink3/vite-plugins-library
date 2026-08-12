# Vite Plugins Library

A curated collection of production-grade custom Vite plugins for asset management, dev proxy rewrites, production deployment redirects, environment variable loading, PostCSS Shadow DOM scoping, CLI color logging, and build optimization.

Inspired by real-world enterprise Vite setups in modern web applications.

---

## 📦 Plugins & Utilities Included

| Export Name | Subpath Import | Description |
| :--- | :--- | :--- |
| `proxyRedirectsPlugin` | `vite-plugins-library/proxy-redirects` | Dynamic dev server proxy rewrites & production deployment redirects for Netlify, Vercel, and Nginx. |
| `logger` | `vite-plugins-library/logger` | Colored ANSI CLI logging system with boxed notifications (`logBox`) and step indicators (`logStep`). |
| `codeSplitPlugin` | `vite-plugins-library/code-split` | Naming strategy for assets (`a/`), CSS (`c/`), and JS chunks (`j/`). |
| `envLoaderPlugin` | `vite-plugins-library/env-loader` | Inject environment variables matching specific prefixes into `process.env.*`. |
| `imageToCdnPlugin` | `vite-plugins-library/image-to-cdn` | Rewrite local image imports to static CDN URLs during production build. |
| `jsAsJsxPlugin` | `vite-plugins-library/js-as-jsx` | Enable writing JSX inside `.js` & `.ts` files using OXC / Esbuild transformer without file renames. |
| `postcssShadowDomPlugin` | `vite-plugins-library/postcss-shadow-dom` | Adapt Tailwind CSS and global `:root` selectors for Web Components & Shadow DOM (`:host`). |
| `publicCssManagePlugin` | `vite-plugins-library/public-css-manage` | Dev asset path resolution + LightningCSS minification for public directory CSS. |
| `buildLogModifierPlugin` | `vite-plugins-library/build-log-modifier` | Suppress specific warning codes (e.g., `EVAL`, `EMPTY_IMPORT_META`) in build logs. |
| `customConfigPlugin` | `vite-plugins-library/custom-config` | Auto-configure path aliases (`@` -> `src`) and deduplicate React core dependencies. |

---

## 🚀 Usage Examples

### 1. Vite Proxy & Redirects Plugin

In your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { proxyRedirectsPlugin } from 'vite-plugins-library';

export default defineConfig({
  plugins: [
    proxyRedirectsPlugin({
      templateFile: 'redirects.template',
      deployPlatform: 'netlify', // 'netlify' | 'vercel' | 'nginx'
    }),
  ],
});
```

Create a `redirects.template` file in your project root:

```text
/api/* {{API_URL}}/api/*
/auth/* {{AUTH_URL}}/*
```

- **Dev Mode**: Vite dev server proxies requests dynamically.
- **Production Build**: Automatically generates `_redirects` (Netlify), `vercel.json` (Vercel), or `nginx.conf.snippet` (Nginx).

### 2. Standalone Logger Utility

```ts
import { logger } from 'vite-plugins-library/logger';

// Boxed message
logger.info('Dev server starting...');
logger.success('Build completed successfully!');
logger.warn('Unused configuration detected.');

// Colored step logger
logger.step('rewrite', '/api/*', '→', 'https://api.example.com/api/*');
```

---

## 🛠️ Building

To build the library package:

```bash
npm run build
```

Outputs will be compiled into `dist/` with full TypeScript declaration files (`.d.ts`), ESM (`.js`), and CommonJS (`.cjs`) modules.
