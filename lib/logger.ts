/* eslint-disable no-console */

/**
 * Lightweight server-side logger.
 * Wraps console methods to satisfy ESLint no-console rule while
 * providing a single point for future logger upgrades (e.g. structured logging).
 */
export const logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
