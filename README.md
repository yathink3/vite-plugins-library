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
| `autoAliasPlugin` | `vite-plugins-library/auto-alias` | **Unified**: Resolves `tsconfig.json` path mappings, auto-creates `@` subfolder aliases for `src/`, and deduplicates package dependencies. |
| `envValidatorPlugin` | `vite-plugins-library/env-validator` | **Unified**: Build-time `.env` variable schema validator with optional `injectToProcessEnv` process.env definition. |
| `devFallbackPlugin` | `vite-plugins-library/dev-fallback` | **Unified**: Intercepts dev server proxy errors (502/503/504), API mock endpoints, or missing 404 routes to serve mock responses or custom SPA error pages. |
| `buildScorerPlugin` | `vite-plugins-library/build-scorer` | **Unified**: Combined build quality scoring, transform performance profiling (file extension metrics & slow transform detection), and bundle budget health auditor (0–100 score, A–F grades). |
| `securityHeadersPlugin` | `vite-plugins-library/security-headers` | Dev/preview HTTP security headers (CSP, COOP for `SharedArrayBuffer`, HSTS, X-Frame-Options) & production host config export (`_headers`, `vercel.json`, `nginx.conf`). |
| `bannerNoticePlugin` | `vite-plugins-library/banner-notice` | Dynamic copyright, license, version, author, git commit hash, and build timestamp banner prepender for JS & CSS bundles. |
| `svgSpritePlugin` | `vite-plugins-library/svg-sprite` | SVG icon pack bundler creating single `<symbol>` SVG sprite sheet (`sprite.svg`) with virtual module & HTML inject support. |
| `resourceHintsPlugin` | `vite-plugins-library/resource-hints` | Core Web Vitals LCP optimizer injecting `<link rel="modulepreload">`, font preloads, CSS preloads, `preconnect`, and `dns-prefetch`. |
| `cacheCleanerPlugin` | `vite-plugins-library/cache-cleaner` | Solves Vite's #1 dev pain point by auto-purging stale `node_modules/.vite` dependency cache when `package.json`/lockfiles update. |
| `customConfigPlugin` | `vite-plugins-library/custom-config` | *(Wrapper)* Path alias & React deduplication wrapper delegating to `autoAliasPlugin`. |
| `envLoaderPlugin` | `vite-plugins-library/env-loader` | *(Wrapper)* Environment variable loader wrapper delegating to `envValidatorPlugin`. |
| `apiMockPlugin` | `vite-plugins-library/api-mock` | *(Wrapper)* Dev server API mock middleware wrapper delegating to `devFallbackPlugin`. |
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

Organizes compiled production build assets into custom subdirectories (`jsDir`, `cssDir`, `assetDir`) and configures Rollup/Rolldown `codeSplitting` and `manualChunks` using custom groups passed via the `groups` prop option.

```ts
import { defineConfig } from 'vite';
import { codeSplitPlugin } from 'vite-plugins-library/code-split';

export default defineConfig({
  plugins: [
    codeSplitPlugin({
      jsDir: 'j',
      cssDir: 'c',
      assetDir: 'a',
      groups: [
        { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/ },
        { name: 'vendor-redux', test: /[\\/]node_modules[\\/](redux|react-redux)[\\/]/ },
      ],
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

Auto-configures path aliases (`@` -> `./src`) and deduplicates React dependencies.

```ts
import { defineConfig } from 'vite';
import { customConfigPlugin } from 'vite-plugins-library/custom-config';

export default defineConfig({
  plugins: [
    customConfigPlugin({
      alias: { '@': '/src' },
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

### 11. Environment Variable Validator Plugin

Validates `.env` variables against a schema at build/dev start. Prevents deploying broken apps with missing keys.

```ts
import { defineConfig } from 'vite';
import { envValidatorPlugin } from 'vite-plugins-library/env-validator';

export default defineConfig({
  plugins: [
    envValidatorPlugin({
      schema: {
        VITE_API_URL: { required: true, type: 'url' },
        VITE_PORT: { type: 'number', default: '3000' },
        VITE_ENABLE_ANALYTICS: { type: 'boolean' },
      },
    }),
  ],
});
```

---

### 12. Asset Pre-Compression Plugin

Pre-compresses build assets into `.gz` (Gzip) and `.br` (Brotli) files during production build using Node's native `zlib` module.

```ts
import { defineConfig } from 'vite';
import { compressionPlugin } from 'vite-plugins-library/compression';

export default defineConfig({
  plugins: [
    compressionPlugin({
      algorithm: 'both', // 'gzip' | 'brotli' | 'both'
      threshold: 1024, // minimum file size in bytes (1 KB)
    }),
  ],
});
```

---

### 13. Dynamic HTML & SEO Meta Plugin

Injects dynamic SEO meta tags, OpenGraph data, Twitter cards, theme colors, and favicons into `index.html`.

```ts
import { defineConfig } from 'vite';
import { htmlMetaPlugin } from 'vite-plugins-library/html-meta';

export default defineConfig({
  plugins: [
    htmlMetaPlugin({
      title: 'Awesome Web App',
      description: 'Enterprise production Vite application',
      themeColor: '#0f172a',
      favicon: '/favicon.svg',
      openGraph: {
        title: 'Awesome Web App',
        image: 'https://example.com/og-image.png',
        url: 'https://example.com',
      },
      twitter: {
        card: 'summary_large_image',
        site: '@example',
      },
    }),
  ],
});
```

---

### 14. Development API Mock Middleware Plugin

Injects dev server middleware to intercept local API calls (e.g. `/api/*`) and serve mock JSON data with simulated latency.

```ts
import { defineConfig } from 'vite';
import { apiMockPlugin } from 'vite-plugins-library/api-mock';

export default defineConfig({
  plugins: [
    apiMockPlugin({
      prefix: '/api',
      mocks: [
        {
          url: '/users',
          method: 'GET',
          delay: 200,
          response: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        },
        {
          url: '/auth/login',
          method: 'POST',
          response: { token: 'mock-jwt-token-xyz' },
        },
      ],
    }),
  ],
});
```

---

### 15. Unified Project Build Quality Scorer & Performance Auditor Plugin

Combines production build quality scoring, letter grades (`A+`, `A`, `B`, `C`, `F`), bundle size budget audits, and transform performance bottleneck profiling into a single unified build auditor.

```ts
import { defineConfig } from 'vite';
import { buildScorerPlugin } from 'vite-plugins-library/build-scorer';

export default defineConfig({
  plugins: [
    buildScorerPlugin({
      maxChunkSizeKb: 500,
      maxTotalBundleMb: 5,
      slowTransformThresholdMs: 500,
      minScoreToPass: 75,
      strict: false, // Set true to fail build if score < minScoreToPass
      jsonReportPath: 'build-score.json',
    }),
  ],
});
```

---

### 16. Automatic Path Alias Resolver Plugin

Automatically resolves path aliases from `tsconfig.json`/`jsconfig.json` `compilerOptions.paths` and auto-maps top-level directories under `src/` (e.g. `@components`, `@hooks`, `@services`, `@assets`).

```ts
import { defineConfig } from 'vite';
import { autoAliasPlugin } from 'vite-plugins-library/auto-alias';

export default defineConfig({
  plugins: [
    autoAliasPlugin({
      autoMapSrcFolders: true, // Auto-maps @components -> src/components, etc.
      prefix: '@',
    }),
  ],
});
```

---

### 17. Dead Code & Unused Asset Scanner Plugin

Audits static asset files in `public/` and `src/assets/` against the Vite module build graph to detect unreferenced images, SVGs, or font files.

```ts
import { defineConfig } from 'vite';
import { deadCodeScannerPlugin } from 'vite-plugins-library/dead-code-scanner';

export default defineConfig({
  plugins: [
    deadCodeScannerPlugin({
      targetDirs: ['public', 'src/assets'],
      exclude: ['favicon.ico', 'robots.txt'],
      reportFile: 'unused-assets.json',
    }),
  ],
});
```

---

### 18. Google Web Font Localizer & Downloader Plugin

Scans `index.html` for Google Fonts CDN links, downloads `.woff2` font files locally during build/dev into public assets, and rewrites HTML to serve self-hosted fonts without GDPR privacy concerns or network latency.

```ts
import { defineConfig } from 'vite';
import { fontLocalizerPlugin } from 'vite-plugins-library/font-localizer';

export default defineConfig({
  plugins: [
    fontLocalizerPlugin({
      outputDir: 'fonts',
      inlineCss: true,
    }),
  ],
});
```

---

### 19. Dev Server Proxy & Route Fallback Recovery Plugin

Intercepts dev server proxy errors (502/503/504 connection failures) and missing SPA client routes to return configurable mock fallbacks or custom HTML error pages.

```ts
import { defineConfig } from 'vite';
import { devFallbackPlugin } from 'vite-plugins-library/dev-fallback';

export default defineConfig({
  plugins: [
    devFallbackPlugin({
      catchProxyErrors: true,
      rules: [
        {
          match: '/api/v1/user',
          response: { status: 'offline', message: 'Backend service unavailable in dev' },
        },
      ],
    }),
  ],
});
```

---

### 20. Open Source License & Compliance Auditor Plugin

Audits imported `node_modules` dependencies during production builds and generates open-source attribution notices (`THIRD_PARTY_LICENSES.md` or `licenses.json`) in `dist/`.

```ts
import { defineConfig } from 'vite';
import { licenseNoticePlugin } from 'vite-plugins-library/license-notice';

export default defineConfig({
  plugins: [
    licenseNoticePlugin({
      outputFile: 'THIRD_PARTY_LICENSES.md',
      format: 'markdown', // 'markdown' | 'json'
    }),
  ],
});
```

---

### 21. HTTP Security Headers & Host Config Exporter Plugin

Enforces security headers (Content-Security-Policy, Cross-Origin-Opener-Policy for `SharedArrayBuffer`, X-Frame-Options, HSTS) during dev and preview modes, and exports production header configuration files (`_headers` for Cloudflare/Netlify, `vercel.json` headers array, `nginx-security.conf`) during build.

```ts
import { defineConfig } from 'vite';
import { securityHeadersPlugin } from 'vite-plugins-library/security-headers';

export default defineConfig({
  plugins: [
    securityHeadersPlugin({
      crossOriginOpenerPolicy: 'same-origin', // enables SharedArrayBuffer support
      xFrameOptions: 'DENY',
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
      },
      exportFormat: ['cloudflare', 'vercel', 'nginx'], // auto-generates _headers, vercel.json, nginx-security.conf
    }),
  ],
});
```

---

### 22. Dynamic Bundle Banner & Notice Inserter Plugin

Prepends customizable build banners, copyright statements, license text, git commit hashes, and build timestamps to generated JS and CSS output chunks without breaking source maps.

```ts
import { defineConfig } from 'vite';
import { bannerNoticePlugin } from 'vite-plugins-library/banner-notice';

export default defineConfig({
  plugins: [
    bannerNoticePlugin({
      banner: 'Project [name] v[version]\nBuilt on [date] (commit [hash])\nCopyright (c) [year] [author]. [license] Licensed.',
      author: 'Acme Corp',
    }),
  ],
});
```

---

### 23. SVG Sprite Sheet Generator & Virtual Module Plugin

Combines individual `.svg` icon files into a single `<symbol>` SVG sprite sheet (`assets/sprite.svg`), offering virtual module imports (`virtual:svg-sprite`) and automatic HTML body injection.

```ts
import { defineConfig } from 'vite';
import { svgSpritePlugin } from 'vite-plugins-library/svg-sprite';

export default defineConfig({
  plugins: [
    svgSpritePlugin({
      iconDir: 'src/assets/icons',
      symbolIdPrefix: 'icon-',
      injectToHtml: true, // Injects <svg style="display:none"><defs>...</defs></svg> into HTML body
    }),
  ],
});
```

---

### 24. Core Web Vitals Resource Hints & Asset Preloader Plugin

Boosts Largest Contentful Paint (LCP) and loading speed by automatically parsing production Rollup assets and injecting `<link rel="modulepreload">`, `<link rel="preload" as="font">`, `<link rel="preload" as="style">`, `preconnect`, and `dns-prefetch` into HTML `<head>`.

```ts
import { defineConfig } from 'vite';
import { resourceHintsPlugin } from 'vite-plugins-library/resource-hints';

export default defineConfig({
  plugins: [
    resourceHintsPlugin({
      modulePreload: true,
      preloadFonts: true,
      preloadCss: true,
      preconnect: ['https://fonts.googleapis.com'],
      dnsPrefetch: ['https://cdn.example.com'],
    }),
  ],
});
```

---

### 25. Automatic Vite Dependency Cache Purger Plugin

Fixes Vite's most frequent dev server pain point ("Failed to resolve import") by computing checksums of `package.json` and lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`) and automatically clearing `node_modules/.vite` whenever dependencies change.

```ts
import { defineConfig } from 'vite';
import { cacheCleanerPlugin } from 'vite-plugins-library/cache-cleaner';

export default defineConfig({
  plugins: [
    cacheCleanerPlugin({
      verbose: true, // Logs CLI notice when stale dependency cache is purged
    }),
  ],
});
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
