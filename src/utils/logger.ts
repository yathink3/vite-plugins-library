/**
 * Severity level types for boxed console log messages.
 */
export type LogType = 'info' | 'warn' | 'error' | 'success';

/**
 * Lightweight ANSI color utility functions for terminal text formatting.
 */
export const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  white: (s: string) => `\x1b[37m${s}\x1b[0m`,
};

let lastContext = '';

/**
 * Output a boxed notification message with status icons and ANSI colors to terminal.
 *
 * @param msg - Text content of the log notification.
 * @param type - Log type identifier determining color and symbol.
 */
export function logBox(msg: string, type: LogType = 'info'): void {
  if (lastContext && lastContext !== '__box__') {
    console.log(); // Gap before a box if preceded by steps
  }
  lastContext = '__box__';

  const colorMap: Record<LogType, (s: string) => string> = {
    info: colors.cyan,
    success: colors.green,
    warn: colors.yellow,
    error: colors.red,
  };
  const symbolMap: Record<LogType, string> = {
    info: 'ℹ',
    success: '✔',
    warn: '⚠',
    error: '✖',
  };

  const color = colorMap[type] || colors.green;
  const symbol = symbolMap[type] || 'ℹ';
  console.log(color(`${symbol}  ${msg}`));
}

/**
 * Output a step progress line with alternating ANSI colors for each component.
 *
 * @param parts - Variadic array of string components forming the step output.
 */
export function logStep(...parts: string[]): void {
  if (parts.length > 0) {
    const currentContext = parts[0];
    if (lastContext && lastContext !== currentContext) {
      console.log(); // Gap between different plugins
    }
    lastContext = currentContext;
  }

  const palette = [
    colors.gray,
    colors.white,
    colors.blue,
    colors.green,
    colors.magenta,
    colors.yellow,
    colors.cyan,
  ];
  const colored = parts.map((part, i) => {
    const color = palette[i % palette.length];
    return color(part);
  });
  console.log(`  ${colors.cyan('↪')} ${colored.join(' ')}`);
}

/**
 * Standalone logger instance providing colored terminal messaging, boxed notifications, and step indicators.
 */
export const logger = {
  colors,
  box: logBox,
  step: logStep,
  info: (msg: string) => logBox(msg, 'info'),
  success: (msg: string) => logBox(msg, 'success'),
  warn: (msg: string) => logBox(msg, 'warn'),
  error: (msg: string) => logBox(msg, 'error'),
};

export default logger;
