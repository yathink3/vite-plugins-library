export type LogType = 'info' | 'warn' | 'error' | 'success';

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

export function logBox(msg: string, type: LogType = 'info'): void {
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

export function logStep(...parts: string[]): void {
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
