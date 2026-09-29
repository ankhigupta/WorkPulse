// Calendar-date arithmetic for YYYY-MM-DD strings — deliberately never goes
// through a bare `new Date(value)` on a value that might carry a time
// component, and always adds/subtracts in UTC so a device's local timezone
// offset can never shift the calendar date by a day.
function toUtcMidnight(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMidnight(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateOnly(): string {
  const now = new Date();
  return fromUtcMidnight(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function shiftDateOnly(value: string, deltaDays: number): string {
  return fromUtcMidnight(toUtcMidnight(value) + deltaDays * 86_400_000);
}

export function isSameDateOnly(a: string, b: string): boolean {
  return a === b;
}

export function startOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return fromUtcMidnight(Date.UTC(year, month - 1, 1));
}

export function endOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  // Day 0 of "next month" is the last day of this one.
  return fromUtcMidnight(Date.UTC(year, month, 0));
}

export function addMonths(value: string, deltaMonths: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return fromUtcMidnight(Date.UTC(year, month - 1 + deltaMonths, day));
}
