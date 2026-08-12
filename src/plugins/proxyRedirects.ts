import fs from 'fs';
import path from 'path';
import { loadEnv, type Plugin } from 'vite';
import { logger, logBox, logStep } from '../utils/logger';

/**
 * Supported target platforms for outputting deployment redirect rules.
 */
export type DeployPlatform = 'netlify' | 'vercel' | 'nginx' | string;

/**
 * Options for the proxyRedirectsPlugin.
 */
export interface ProxyRedirectsOptions {
  /**
   * Relative path to the template file containing proxy/redirect rules.
   * @default 'redirects.template'
   */
  templateFile?: string;
  /**
   * Inline template string containing proxy/redirect rules. Overrides `templateFile` if provided.
   */
  templateString?: string;
  /**
   * Custom key-value map of environment variable replacements for template placeholders (`{{VAR_NAME}}`).
   */
  envMap?: Record<string, string>;
  /**
   * Target deployment platform for production build redirect output (`'netlify'`, `'vercel'`, or `'nginx'`).
   * @default 'netlify'
   */
  deployPlatform?: DeployPlatform;
  /**
   * If true, suppresses writing production redirect files during build.
   * @default false
   */
  ignoreBuild?: boolean;
  /**
   * Custom output directory path for generated redirect configuration files. Defaults to Vite build outDir.
   */
  outDir?: string;
}

const getLines = (tpl: string): string[] =>
  tpl
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

const extractVars = (str: string): string[] => [
  ...new Set(str.match(/{{(.*?)}}/g)?.map(m => m.slice(2, -2)) || []),
];

const hasAllEnvVars = (str: string, envMap: Record<string, string>): boolean =>
  extractVars(str).every(k => envMap[k]);

const applyEnv = (str: string, envMap: Record<string, string>): string =>
  str.replace(/{{(.*?)}}/g, (_, k) => envMap[k] || '');

const splitTargetPath = (url: string) => {
  const target = url.match(/^https?:\/\/[^/]+/)?.[0] || '';
  const urlpart = url.slice(target.length);
  const pathPart = (urlpart.replace(/\*/g, '').replace(/:\w+$/, '') || '/').replace(/\/+$/, '/');
  return { target, pathPart };
};

const makeProxyEntry = (prefix: string, { target, pathPart }: { target: string; pathPart: string }) => {
  const entry: any = { target, changeOrigin: true, secure: false };
  if (pathPart !== '/' && !pathPart.startsWith(prefix)) {
    const pat = new RegExp(`^${prefix}`);
    entry.rewrite = (p: string) => p.replace(pat, pathPart);
  }
  return entry;
};

const detectPlatform = (envMap: Record<string, string>): string => {
  const flag = (v?: string) => String(v || '').toLowerCase();
  const platform = flag(envMap.DEPLOY_PLATFORM);
  if (platform === 'vercel') return 'vercel';
  if (platform === 'netlify') return 'netlify';
  if (platform === 'nginx') return 'nginx';
  if (envMap.VERCEL === '1') return 'vercel';
  if (envMap.NETLIFY === 'true') return 'netlify';
  return '';
};

// ─────────────── redirect writers ───────────────
const writeNetlifyRedirects = (lines: string[], envMap: Record<string, string>, outputPath: string) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const redirects = lines
    .map(line => {
      const [from, to] = line.split(/\s+/);
      const resolvedTo = applyEnv(to, envMap).replace(/\*/g, ':splat');
      if (from === '/*' && resolvedTo === '/index.html') return '';
      return `${from} ${resolvedTo} 200!`;
    })
    .filter(Boolean);
  redirects.push('/* /index.html 200');
  const result = redirects.join('\n');
  fs.writeFileSync(outputPath, result);
};

const writeVercelRedirects = (lines: string[], envMap: Record<string, string>, outputPath: string) => {
  const rewrites = lines
    .map(line => {
      const [from, to] = line.split(/\s+/);
      const resolvedTo = applyEnv(to, envMap).replace(/\*/g, '').replace(/:\w+$/, '');
      if (from === '/*' && resolvedTo === '/index.html') return '';
      return { source: from, destination: resolvedTo };
    })
    .filter(Boolean);
  rewrites.push({ source: '/(.*)', destination: '/' });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const json = { rewrites };
  fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
};

const writeNginxRedirects = (lines: string[], envMap: Record<string, string>, outputPath: string) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const header = `# Nginx Redirects
#
# Copy and paste the following rewrite rules into your Nginx server block.
\n`;

  const rewriteRules = lines.map(line => {
    const [from, to] = line.split(/\s+/);
    const escapedFrom = from.replace(/([.])/g, '\\$1').replace(/\*$/, '(.*)');
    const resolvedTo = applyEnv(to, envMap);
    const resolvedToWithCapture = resolvedTo.endsWith('$1') ? resolvedTo : `${resolvedTo}$1`;
    return `rewrite ^${escapedFrom}$ ${resolvedToWithCapture} permanent;`;
  });
  fs.writeFileSync(outputPath, header + rewriteRules.join('\n'));
};

const buildProxyMap = (template: string, envMap: Record<string, string>, log: boolean = false) => {
  const proxy: Record<string, any> = {};
  for (const line of getLines(template)) {
    if (!hasAllEnvVars(line, envMap)) continue;
    const [from, raw] = line.split(/\s+/);
    if (!from || !raw) continue;
    const route = from.replace(/\*$/, '');
    if (route === '/') continue;
    const resolved = applyEnv(raw, envMap);
    const { target, pathPart } = splitTargetPath(resolved);
    proxy[route] = makeProxyEntry(route, { target, pathPart });
    if (log) logStep('rewrite', route, '→', `${target}${pathPart}`);
  }
  return proxy;
};

/**
 * Creates a Vite plugin that configures development proxy rewrites
 * and generates production redirect configurations for Netlify, Vercel, or Nginx.
 */
export default function proxyRedirectsPlugin(options: ProxyRedirectsOptions = {}): Plugin {
  const {
    templateFile = 'redirects.template',
    templateString = '',
    envMap = {},
    deployPlatform = 'netlify',
    ignoreBuild = false,
  } = options;

  let template = templateString;
  let rootDir = process.cwd();
  let activeEnvMap: Record<string, string> = {};
  let outDir = 'dist';

  return {
    name: 'vite-plugin-proxy-redirects',
    enforce: 'post',
    apply: () => true,
    config(c, { command, mode }) {
      rootDir = c.root || process.cwd();
      if (!template) {
        const templatePath = path.resolve(rootDir, templateFile);
        try {
          template = fs.readFileSync(templatePath, 'utf8');
        } catch (e) {
          logBox(`${templateFile} not found at project root`, 'warn');
          template = '';
        }
      }

      const env = loadEnv(mode, rootDir, '');
      const mergedEnv = { ...env, ...envMap };
      const allVars = [...new Set(getLines(template).flatMap(extractVars))];
      activeEnvMap = Object.fromEntries(allVars.map(k => [k, mergedEnv[k]]).filter(([, v]) => !!v));

      if (command === 'serve' && template) {
        const proxy = buildProxyMap(template, activeEnvMap, true);
        c.server = c.server || {};
        c.server.proxy = { ...(c.server.proxy || {}), ...proxy };
        logBox('Development redirects loaded', 'success');
      }
    },
    configResolved(config) {
      outDir = options.outDir || config.build.outDir || 'dist';
    },
    generateBundle() {
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd && !ignoreBuild && template) {
        try {
          const lines = getLines(template).filter(line => hasAllEnvVars(line, activeEnvMap));
          const platform = detectPlatform(activeEnvMap) || deployPlatform || 'unknown';

          let successMessage = '';
          if (platform === 'netlify') {
            const outputPath = path.resolve(outDir, '_redirects');
            writeNetlifyRedirects(lines, activeEnvMap, outputPath);
            successMessage = `Wrote Netlify _redirects to ${outputPath}`;
          } else if (platform === 'vercel') {
            const vercelPath = path.resolve(outDir, 'vercel.json');
            writeVercelRedirects(lines, activeEnvMap, vercelPath);
            successMessage = `Wrote Vercel redirects to ${vercelPath}`;
          } else if (platform === 'nginx') {
            const nginxPath = path.resolve(outDir, 'nginx.conf.snippet');
            writeNginxRedirects(lines, activeEnvMap, nginxPath);
            successMessage = `Wrote Nginx config snippet to ${nginxPath}`;
          } else {
            logBox(`Unknown deploy platform. Set DEPLOY_PLATFORM=netlify|vercel|nginx`, 'warn');
            return;
          }
          console.log('\n');
          buildProxyMap(lines.join('\n'), activeEnvMap, true);
          logBox(successMessage, 'success');
        } catch (e: any) {
          logBox(`Failed writing redirects: ${e.message}`, 'error');
        }
      }
    },
  };
}
