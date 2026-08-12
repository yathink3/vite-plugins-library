import { loadEnv, type Plugin } from 'vite';
import { logBox, logStep } from '../utils/logger';

/**
 * Validation rule configuration for a specific environment variable key.
 */
export interface EnvValidationRule {
  /**
   * Whether the environment variable is required to be set and non-empty.
   * @default false
   */
  required?: boolean;
  /**
   * Expected data type format of the variable value.
   */
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email';
  /**
   * Custom RegExp pattern that the value must match.
   */
  pattern?: RegExp;
  /**
   * Default value fallback if the variable is not set.
   */
  default?: string;
  /**
   * Custom error message to display if validation fails.
   */
  message?: string;
}

/**
 * Options for the envValidatorPlugin.
 */
export interface EnvValidatorOptions {
  /**
   * Schema mapping environment variable keys to validation rules or a boolean (`true` for required).
   */
  schema?: Record<string, EnvValidationRule | boolean>;
  /**
   * Prefix list passed to Vite's `loadEnv` (e.g. `['VITE_', 'BASE_']`).
   * @default ['']
   */
  prefixes?: string[];
  /**
   * If true, throws a build error and halts execution when validation fails.
   * @default true
   */
  strict?: boolean;
  /**
   * If true, automatically injects matched environment variables into `process.env.*` via `config.define`.
   * @default false
   */
  injectToProcessEnv?: boolean;
  /**
   * Directory path containing `.env` files. Defaults to project root.
   */
  envDir?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateValue(key: string, val: string | undefined, rule: EnvValidationRule): string | null {
  const isRequired = rule.required ?? false;

  if (!val || val.trim() === '') {
    if (isRequired) {
      return rule.message || `Environment variable "${key}" is required but missing or empty.`;
    }
    return null;
  }

  if (rule.type) {
    switch (rule.type) {
      case 'number':
        if (isNaN(Number(val))) {
          return rule.message || `Environment variable "${key}" must be a valid number, got "${val}".`;
        }
        break;
      case 'boolean':
        if (!['true', 'false', '1', '0'].includes(val.toLowerCase())) {
          return rule.message || `Environment variable "${key}" must be a boolean ('true'|'false'), got "${val}".`;
        }
        break;
      case 'url':
        try {
          new URL(val);
        } catch {
          return rule.message || `Environment variable "${key}" must be a valid URL, got "${val}".`;
        }
        break;
      case 'email':
        if (!EMAIL_REGEX.test(val)) {
          return rule.message || `Environment variable "${key}" must be a valid email address, got "${val}".`;
        }
        break;
    }
  }

  if (rule.pattern && !rule.pattern.test(val)) {
    return rule.message || `Environment variable "${key}" failed custom pattern test.`;
  }

  return null;
}

/**
 * Vite plugin to validate environment variables against a schema at dev/build start, halting builds early on invalid configuration.
 *
 * @param options - Configuration options for variable schema validation rules and process.env injection.
 * @returns A Vite Plugin object.
 */
export default function envValidatorPlugin(options: EnvValidatorOptions = {}): Plugin {
  const schema = options.schema || {};
  const prefixes = options.prefixes || [''];
  const isStrict = options.strict !== false;
  const injectToProcessEnv = options.injectToProcessEnv === true;

  return {
    name: 'vite-plugin-env-validator',
    config(_c, { mode }) {
      const root = options.envDir || _c.root || process.cwd();
      const env = loadEnv(mode, root, prefixes);
      const errors: string[] = [];

      for (const [key, ruleOrBool] of Object.entries(schema)) {
        const rule: EnvValidationRule = typeof ruleOrBool === 'boolean'
          ? { required: ruleOrBool }
          : ruleOrBool;

        const val = env[key] ?? process.env[key] ?? rule.default;
        const err = validateValue(key, val, rule);
        if (err) {
          errors.push(err);
        }
      }

      if (errors.length > 0) {
        logBox(`Environment Variable Validation Failed (${errors.length} error${errors.length > 1 ? 's' : ''})`, 'error');
        for (const err of errors) {
          logStep('fail', err);
        }
        if (isStrict) {
          throw new Error(`[envValidatorPlugin] Build aborted due to ${errors.length} environment validation failure(s).`);
        }
      }

      if (injectToProcessEnv) {
        const define = (_c.define = _c.define || {});
        for (const [key, value] of Object.entries(env)) {
          define[`process.env.${key}`] = JSON.stringify(value);
        }
      }
    },
  };
}
