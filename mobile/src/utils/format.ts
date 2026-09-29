// Some endpoints (Dashboard's period) send a plain "YYYY-MM-DD"; others
// (Employee.joinedAt — a raw Prisma DateTime, never reformatted server-side)
// send a full ISO datetime like "2026-01-15T00:00:00.000Z". Both forms
// always start with the calendar date, so slicing to 10 chars normalizes
// either shape before it's ever parsed or shown in a form field.
export function toDateOnlyString(value: string): string {
  return value.slice(0, 10);
}

// Passing a date-only string straight to `new Date(...)` and formatting in
// the device's local timezone can shift the displayed calendar date by a
// day — the same UTC-safe discipline the backend applies to every
// date-only field applies here too: parse as UTC midnight, and always
// format with `timeZone: "UTC"` explicitly.
function parseDateOnly(value: string): Date {
  return new Date(`${toDateOnlyString(value)}T00:00:00Z`);
}

export function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    parseDateOnly(value),
  );
}

export function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  const isFullMonth =
    start.getUTCDate() === 1 &&
    end.getUTCMonth() === start.getUTCMonth() &&
    end.getUTCFullYear() === start.getUTCFullYear() &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();

  if (isFullMonth) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
  }

  const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const yearSuffix = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }).format(end);
  return `${dayFormat.format(start)} – ${dayFormat.format(end)}, ${yearSuffix}`;
}

// Amounts arrive as decimal strings (Prisma.Decimal -> JSON string), never
// numbers — this only formats for display, it never feeds back into a
// calculation, so rendering it through Number() here is safe.
export function formatCurrency(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `₹${formatted}`;
}
