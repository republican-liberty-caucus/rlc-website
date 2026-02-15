/* eslint-disable no-console */

type LogLevel = 'error' | 'warn' | 'info';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  if (env && env in LEVEL_PRIORITY) return env;
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

const minLevel = getMinLevel();
const minPriority = LEVEL_PRIORITY[minLevel];

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= minPriority;
}

/**
 * Environment-aware logger with level filtering.
 * - Production: only warn and error by default
 * - Development: all levels
 * - Override with LOG_LEVEL env var (error | warn | info)
 */
export const logger = {
  info: (...args: unknown[]) => { if (shouldLog('info')) console.log(...args); },
  warn: (...args: unknown[]) => { if (shouldLog('warn')) console.warn(...args); },
  error: (...args: unknown[]) => { if (shouldLog('error')) console.error(...args); },
};
