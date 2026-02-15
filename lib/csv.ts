/**
 * Escape a CSV field to prevent formula injection and handle special characters.
 * - Prefixes formula-triggering characters (=, +, -, @, tab, return) with single quote
 * - Wraps in double quotes and escapes internal quotes
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}
