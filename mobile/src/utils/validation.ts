export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deliberately string-only validation, never constructed into a Date — the
// value is sent to the API verbatim as YYYY-MM-DD, so there is no local-vs-UTC
// timezone shift risk at all on the client side.
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Reject e.g. 2024-02-30 — construct at UTC midnight and check the
  // components round-trip, rather than trusting the regex shape alone.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
