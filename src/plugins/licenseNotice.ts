import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { logStep } from '../utils/logger';

/**
 * Options for the licenseNoticePlugin.
 */
export interface LicenseNoticeOptions {
  /**
   * Output file path relative to build dist directory.
   * @default 'THIRD_PARTY_LICENSES.md'
   */
  outputFile?: string;
  /**
   * Output format for the license attribution report.
   * @default 'markdown'
   */
  format?: 'markdown' | 'json';
  /**
   * Include exact LICENSE file text if found inside node_modules package folder.
   * @default false
   */
  includeLicenseText?: boolean;
}

interface DependencyInfo {
  name: string;
  version: string;
  license: string;
  repository?: string;
  homepage?: string;
  licenseText?: string;
}

/**
 * Finds the enclosing node_modules package root directory for a given module filepath.
 */
function findPackageRoot(modulePath: string): string | null {
  let dir = path.dirname(modulePath);

  while (dir && dir !== path.dirname(dir)) {
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      return dir;
    }
    if (dir.endsWith('node_modules')) break;
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Vite plugin that inspects imported `node_modules` dependencies during production build
 * and generates a formatted open-source license attribution notice (`THIRD_PARTY_LICENSES.md` or `.json`) in `dist/`.
 *
 * @param options - Configuration options for output filename, format, and license text inclusion.
 * @returns A Vite Plugin object.
 */
export default function licenseNoticePlugin(options: LicenseNoticeOptions = {}): Plugin {
  const outputFile = options.outputFile || 'THIRD_PARTY_LICENSES.md';
  const format = options.format || 'markdown';
  const includeLicenseText = options.includeLicenseText === true;

  return {
    name: 'vite-plugin-license-notice',
    apply: 'build',
    generateBundle() {
      const packageRoots = new Set<string>();

      // 1. Collect all node_modules files imported in module graph
      for (const moduleId of this.getModuleIds()) {
        if (moduleId.includes('node_modules')) {
          const cleanId = moduleId.split('?')[0];
          const pkgRoot = findPackageRoot(cleanId);
          if (pkgRoot) {
            packageRoots.add(pkgRoot);
          }
        }
      }

      const dependencies: Map<string, DependencyInfo> = new Map();

      // 2. Parse package.json for each dependency
      for (const pkgRoot of packageRoots) {
        try {
          const pkgJsonPath = path.join(pkgRoot, 'package.json');
          if (!fs.existsSync(pkgJsonPath)) continue;

          const raw = fs.readFileSync(pkgJsonPath, 'utf8');
          const pkg = JSON.parse(raw);
          if (!pkg.name) continue;

          const key = `${pkg.name}@${pkg.version || 'unknown'}`;
          if (dependencies.has(key)) continue;

          let licenseStr = pkg.license || 'UNSPECIFIED';
          if (typeof pkg.license === 'object' && pkg.license.type) {
            licenseStr = pkg.license.type;
          } else if (Array.isArray(pkg.licenses)) {
            licenseStr = pkg.licenses.map((l: any) => (typeof l === 'object' ? l.type : l)).join(', ');
          }

          let repoStr: string | undefined = undefined;
          if (typeof pkg.repository === 'string') {
            repoStr = pkg.repository;
          } else if (pkg.repository && typeof pkg.repository.url === 'string') {
            repoStr = pkg.repository.url;
          }

          let licenseText: string | undefined = undefined;
          if (includeLicenseText) {
            const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md'];
            for (const file of licenseFiles) {
              const fullLicensePath = path.join(pkgRoot, file);
              if (fs.existsSync(fullLicensePath)) {
                licenseText = fs.readFileSync(fullLicensePath, 'utf8');
                break;
              }
            }
          }

          dependencies.set(key, {
            name: pkg.name,
            version: pkg.version || '0.0.0',
            license: licenseStr,
            repository: repoStr,
            homepage: pkg.homepage,
            licenseText,
          });
        } catch {
          // Ignore parsing errors
        }
      }

      logStep('licenses', `Audited ${dependencies.size} third-party open source dependency licenses`);

      const depList = Array.from(dependencies.values()).sort((a, b) => a.name.localeCompare(b.name));

      // 3. Format output
      let content = '';

      if (format === 'json') {
        content = JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            totalDependencies: depList.length,
            dependencies: depList,
          },
          null,
          2
        );
      } else {
        const lines: string[] = [];
        lines.push('# Third-Party Open Source Software Licenses');
        lines.push('');
        lines.push(`This application bundles the following ${depList.length} third-party npm package(s):`);
        lines.push('');

        for (const dep of depList) {
          lines.push(`## ${dep.name} (${dep.version})`);
          lines.push(`- **License:** ${dep.license}`);
          if (dep.homepage) lines.push(`- **Homepage:** ${dep.homepage}`);
          if (dep.repository) lines.push(`- **Repository:** ${dep.repository}`);
          if (dep.licenseText) {
            lines.push('');
            lines.push('```');
            lines.push(dep.licenseText.trim());
            lines.push('```');
          }
          lines.push('');
        }

        content = lines.join('\n');
      }

      // 4. Emit file in output dist
      this.emitFile({
        type: 'asset',
        fileName: outputFile,
        source: content,
      });

      logStep('licenses', '[SUCCESS]', `Generated open source attribution file "${outputFile}"`);
    },
  };
}
