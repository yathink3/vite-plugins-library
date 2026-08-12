import type { Plugin } from 'vite';

/**
 * Open Graph meta tag configuration options.
 */
export interface OpenGraphMetaOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
}

/**
 * Twitter card meta tag configuration options.
 */
export interface TwitterCardMetaOptions {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Options for the htmlMetaPlugin.
 */
export interface HtmlMetaOptions {
  /**
   * HTML Document Title (`<title>`).
   */
  title?: string;
  /**
   * Meta Description (`<meta name="description">`).
   */
  description?: string;
  /**
   * Meta Keywords array (`<meta name="keywords">`).
   */
  keywords?: string[];
  /**
   * Author name (`<meta name="author">`).
   */
  author?: string;
  /**
   * Theme color string (`<meta name="theme-color">`).
   */
  themeColor?: string;
  /**
   * Favicon image URL path (`<link rel="icon">`).
   */
  favicon?: string;
  /**
   * Open Graph social card options (`og:*`).
   */
  openGraph?: OpenGraphMetaOptions;
  /**
   * Twitter Card social card options (`twitter:*`).
   */
  twitter?: TwitterCardMetaOptions;
  /**
   * Custom arbitrary meta tag objects to append into `<head>`.
   */
  meta?: Array<Record<string, string>>;
}

/**
 * Vite plugin to dynamically inject SEO meta tags, OpenGraph data, Twitter Cards, theme colors, and favicons into `index.html`.
 *
 * @param options - Configuration options for HTML title, meta tags, and social cards.
 * @returns A Vite Plugin object.
 */
export default function htmlMetaPlugin(options: HtmlMetaOptions = {}): Plugin {
  return {
    name: 'vite-plugin-html-meta',
    transformIndexHtml(html) {
      const metaTags: string[] = [];

      if (options.title) {
        // Replace existing <title> tag if present, or add to metaTags
        if (/<title>.*<\/title>/i.test(html)) {
          html = html.replace(/<title>.*<\/title>/i, `<title>${options.title}</title>`);
        } else {
          metaTags.push(`<title>${options.title}</title>`);
        }
      }

      if (options.description) {
        metaTags.push(`<meta name="description" content="${options.description}">`);
      }

      if (options.keywords && options.keywords.length > 0) {
        metaTags.push(`<meta name="keywords" content="${options.keywords.join(', ')}">`);
      }

      if (options.author) {
        metaTags.push(`<meta name="author" content="${options.author}">`);
      }

      if (options.themeColor) {
        metaTags.push(`<meta name="theme-color" content="${options.themeColor}">`);
      }

      if (options.favicon) {
        metaTags.push(`<link rel="icon" href="${options.favicon}">`);
      }

      if (options.openGraph) {
        const og = options.openGraph;
        if (og.title || options.title) metaTags.push(`<meta property="og:title" content="${og.title || options.title}">`);
        if (og.description || options.description) metaTags.push(`<meta property="og:description" content="${og.description || options.description}">`);
        if (og.image) metaTags.push(`<meta property="og:image" content="${og.image}">`);
        if (og.url) metaTags.push(`<meta property="og:url" content="${og.url}">`);
        if (og.type) metaTags.push(`<meta property="og:type" content="${og.type || 'website'}">`);
        if (og.siteName) metaTags.push(`<meta property="og:site_name" content="${og.siteName}">`);
      }

      if (options.twitter) {
        const tw = options.twitter;
        metaTags.push(`<meta name="twitter:card" content="${tw.card || 'summary_large_image'}">`);
        if (tw.site) metaTags.push(`<meta name="twitter:site" content="${tw.site}">`);
        if (tw.creator) metaTags.push(`<meta name="twitter:creator" content="${tw.creator}">`);
        if (tw.title || options.title) metaTags.push(`<meta name="twitter:title" content="${tw.title || options.title}">`);
        if (tw.description || options.description) metaTags.push(`<meta name="twitter:description" content="${tw.description || options.description}">`);
        if (tw.image) metaTags.push(`<meta name="twitter:image" content="${tw.image}">`);
      }

      if (options.meta && Array.isArray(options.meta)) {
        for (const metaObj of options.meta) {
          const attrs = Object.entries(metaObj)
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');
          metaTags.push(`<meta ${attrs}>`);
        }
      }

      if (metaTags.length === 0) return html;

      const tagString = `\n    ${metaTags.join('\n    ')}\n  `;

      if (html.includes('</head>')) {
        return html.replace('</head>', `${tagString}</head>`);
      }

      return html + tagString;
    },
  };
}
