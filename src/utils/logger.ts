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
 * Output a grid of step progress lines with aligned columns and alternating ANSI colors.
 *
 * @param context - The initial string component forming the step output (e.g. plugin name).
 * @param rows - 2D array of string components representing the grid rows.
 * @param align - Array of alignment settings for each column ('left' or 'right').
 */
export function logGrid(context: string, rows: string[][], align: ('left' | 'right')[] = []): void {
  if (rows.length === 0) return;
  const maxLengths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      maxLengths[i] = Math.max(maxLengths[i] || 0, cell.length);
    });
  }

  for (const row of rows) {
    const padded = row.map((cell, i) => {
      const isRight = align && align[i] === 'right';
      return isRight ? cell.padStart(maxLengths[i]) : cell.padEnd(maxLengths[i]);
    });
    logStep(context, ...padded);
  }
}

/**
 * Creates an animated terminal spinner to indicate loading state.
 *
 * @param text - The loading message to display.
 * @param context - The context component (e.g. plugin name).
 */
export function createSpinner(text: string) {
  const frames = ['.  ', '.. ', '...'];
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentText = text;

  const render = () => {
    process.stdout.write('\r\x1b[K');
    process.stdout.write(`${colors.white(currentText)}${frames[i]}`);
    i = (i + 1) % frames.length;
  };

  return {
    start() {
      if (timer) return;
      render();
      timer = setInterval(render, 400);
    },
    update(newText: string) {
      currentText = newText;
      if (timer) render();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      process.stdout.write('\r\x1b[K');
    }
  };
}

/**
 * Standalone logger instance providing colored terminal messaging, boxed notifications, and step indicators.
 */
export const logger = {
  colors,
  box: logBox,
  step: logStep,
  grid: logGrid,
  spinner: createSpinner,
  info: (msg: string) => logBox(msg, 'info'),
  success: (msg: string) => logBox(msg, 'success'),
  warn: (msg: string) => logBox(msg, 'warn'),
  error: (msg: string) => logBox(msg, 'error'),
};

export default logger;
