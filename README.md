# vite-plugins-library

> A curated collection of production-grade custom Vite plugins for asset management, dev proxy rewrites, production deployment redirects, environment variable loading, PostCSS Shadow DOM scoping, CLI color logging, and build optimization.

Inspired by real-world enterprise Vite setups for modern web applications.

[![npm version](https://img.shields.io/npm/v/vite-plugins-library.svg)](https://www.npmjs.com/package/vite-plugins-library)
[![license](https://img.shields.io/npm/l/vite-plugins-library.svg)](https://github.com/yathink3/vite-plugins-library/blob/main/LICENSE)

---

## 📦 Installation

Install via your preferred package manager:

```bash
npm install vite-plugins-library -D
# or
pnpm add vite-plugins-library -D
# or
yarn add vite-plugins-library -D
# or
bun add vite-plugins-library -D
```

---

## 🧩 Plugins & Utilities Overview

All plugins support both **main library imports** and **tree-shakable subpath imports**.

| Plugin / Utility | Subpath Import | Description |
| :--- | :--- | :--- |
| `postcssShadowDomTailwindPlugin` | `vite-plugins-library/postcss-shadow-dom` | Adapts Tailwind CSS v4+ & global styles for Web Components / Shadow DOM (`:host`). Removes duplicate selectors & appends header comments. |
| `proxyRedirectsPlugin` | `vite-plugins-library/proxy-redirects` | Dynamic dev server proxy rewrites & production deployment redirects for Netlify (`_redirects`), Vercel (`vercel.json`), and Nginx (`nginx.conf.snippet`). |
| `codeSplitPlugin` | `vite-plugins-library/code-split` | Structured Rollup output chunk naming strategy for assets (`a/`), CSS (`c/`), and JS (`j/`). |
| `envLoaderPlugin` | `vite-plugins-library/env-loader` | Injects environment variables matching specific prefixes into `process.env.*`. |
| `imageToCdnPlugin` | `vite-plugins-library/image-to-cdn` | Rewrites local image asset imports to static CDN URLs during production builds. |
| `jsAsJsxPlugin` | `vite-plugins-library/js-as-jsx` | Enables writing JSX inside `.js` & `.ts` files using Esbuild without renaming files to `.jsx`/`.tsx`. |
| `publicCssManagePlugin` | `vite-plugins-library/public-css-manage` | Manages public CSS assets during dev mode and optimizes/minifies public CSS files during production builds. |
| `buildLogModifierPlugin` | `vite-plugins-library/build-log-modifier` | Suppresses specific build warning codes (e.g. `EVAL`, `EMPTY_IMPORT_META`) from Vite logs. |
| `customConfigPlugin` | `vite-plugins-library/custom-config` | Auto-configures path aliases (`@` -> `src`) and deduplicates React core dependencies. |
| `logger` | `vite-plugins-library/logger` | Colored ANSI CLI logging system with boxed notifications (`logBox`) and step indicators (`logStep`). |

---

## 🚀 Usage Guide

### 1. PostCSS Shadow DOM & Tailwind CSS Plugin

Adapts global CSS and Tailwind CSS v4+ rules for Web Components / Shadow DOM by converting `:root` to `:host`, deduplicating selectors, stripping existing comments, and prepending `/*! tailwindcss v4+ shadow-dom */`.

```ts
import { defineConfig } from 'vite';
import { postcssShadowDomTailwindPlugin } from 'vite-plugins-library/postcss-shadow-dom';

export default defineConfig({
  plugins: [
    postcssShadowDomTailwindPlugin({
      themePrefix: '.theme-', // default: '.theme-'
    }),
  ],
});
```

---

### 2. Proxy & Production Redirects Plugin

Generates dynamic dev proxy rules and exports deployment redirect configurations for Netlify, Vercel, or Nginx during build.

```ts
import { defineConfig } from 'vite';
import { proxyRedirectsPlugin } from 'vite-plugins-library/proxy-redirects';

export default defineConfig({
  plugins: [
    proxyRedirectsPlugin({
      templateFile: 'redirects.template',
      deployPlatform: 'netlify', // 'netlify' | 'vercel' | 'nginx'
    }),
  ],
});
```

**Example `redirects.template` file in project root:**
```text
/api/* {{API_URL}}/api/*
/auth/* {{AUTH_URL}}/*
```

---

### 3. Code Splitting & Output Formatting Plugin

Organizes compiled production build assets into structured subdirectories (`a/` for assets, `c/` for CSS, `j/` for JS chunks).

```ts
import { defineConfig } from 'vite';
import { codeSplitPlugin } from 'vite-plugins-library/code-split';

export default defineConfig({
  plugins: [
    codeSplitPlugin({
      jsDir: 'j',
      cssDir: 'c',
      assetDir: 'a',
    }),
  ],
});
```

---

### 4. JS as JSX Plugin

Allows writing JSX inside standard `.js` and `.ts` files without renaming them to `.jsx` or `.tsx`.

```ts
import { defineConfig } from 'vite';
import { jsAsJsxPlugin } from 'vite-plugins-library/js-as-jsx';

export default defineConfig({
  plugins: [
    jsAsJsxPlugin(),
  ],
});
```

---

### 5. Image to CDN Plugin

Automatically rewrites local image asset imports to your production CDN URL.

```ts
import { defineConfig } from 'vite';
import { imageToCdnPlugin } from 'vite-plugins-library/image-to-cdn';

export default defineConfig({
  plugins: [
    imageToCdnPlugin({
      cdnUrl: 'https://cdn.example.com',
      extensions: ['.png', '.jpg', '.jpeg', '.svg', '.webp'],
    }),
  ],
});
```

---

### 6. Public CSS Management Plugin

Manages path resolution for public CSS assets during dev mode and minifies them during production builds.

```ts
import { defineConfig } from 'vite';
import { publicCssManagePlugin } from 'vite-plugins-library/public-css-manage';

export default defineConfig({
  plugins: [
    publicCssManagePlugin({
      folders: ['css', 'styles'],
      minifyInProduction: true,
    }),
  ],
});
```

---

### 7. Environment Variables Loader Plugin

Injects variables matching specified prefixes into `process.env`.

```ts
import { defineConfig } from 'vite';
import { envLoaderPlugin } from 'vite-plugins-library/env-loader';

export default defineConfig({
  plugins: [
    envLoaderPlugin({
      prefixes: ['VITE_', 'PUBLIC_'],
    }),
  ],
});
```

---

### 8. Custom Config & Alias Plugin

Auto-configures standard path aliases (`@` -> `./src`) and deduplicates React dependencies.

```ts
import { defineConfig } from 'vite';
import { customConfigPlugin } from 'vite-plugins-library/custom-config';

export default defineConfig({
  plugins: [
    customConfigPlugin({
      alias: { '@': '/src' },
      dedupeReact: true,
    }),
  ],
});
```

---

### 9. Build Log Modifier Plugin

Suppresses annoying or non-critical build warning codes from terminal output.

```ts
import { defineConfig } from 'vite';
import { buildLogModifierPlugin } from 'vite-plugins-library/build-log-modifier';

export default defineConfig({
  plugins: [
    buildLogModifierPlugin({
      suppressCodes: ['EVAL', 'EMPTY_IMPORT_META'],
    }),
  ],
});
```

---

### 10. Standalone CLI Logger Utility

A lightweight, zero-dependency ANSI logger with boxed announcements and step progress logging.

```ts
import { logger } from 'vite-plugins-library/logger';

// Standard levels
logger.info('Dev server starting...');
logger.success('Build completed successfully!');
logger.warn('Deprecation warning detected');
logger.error('Build step failed');

// Boxed notification
logger.box('DEPRECATION NOTICE', 'Vite CJS mode is deprecated. Use ESM mode.');

// Step progress indicator
logger.step('rewrite', '/api/*', '→', 'https://api.example.com/api/*');
```

---

## 🛠️ Development & Building

To build the library package locally:

```bash
npm run build
```

This compiles TypeScript definitions (`.d.ts`) and ESM JavaScript bundles (`.js`) into the `dist/` directory.

---

## 📄 License

[MIT](./LICENSE) © [yathink3](https://github.com/yathink3)
