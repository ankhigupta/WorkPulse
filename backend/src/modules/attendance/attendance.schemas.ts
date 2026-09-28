import { z } from "zod";

// Date-only, UTC-safe. z.string().date() strictly enforces "YYYY-MM-DD"
// (no time component) before we ever call `new Date(...)`. That matters:
// the ECMA-262 spec parses a bare date-only string ("2026-01-15") as UTC
// midnight, but a datetime string with no timezone suffix
// ("2026-01-15T10:00:00") parses as LOCAL time instead. A looser
// z.coerce.date() would accept either form, so on a server running in a
// positive-UTC-offset timezone a client sending the second form could
// silently shift the stored calendar date back a day. Locking the input
// format first removes that ambiguity entirely — verified empirically
// against the real Postgres DATE column before writing this.
const dateOnly = z
  .string()
  .date()
  .transform((value) => new Date(value));

const attendanceStatus = z.enum(["PRESENT", "ABSENT"]);
const attendanceMethod = z.enum(["QR", "MANUAL"]);

export const createAttendanceSchema = z
  .object({
    employeeId: z.string().uuid(),
    date: dateOnly,
    status: attendanceStatus,
    method: attendanceMethod,
    checkInAt: z.coerce.date().optional(),
  })
  .strict();

// Only `method` is editable here. Attendance status changes go through the
// separate AttendanceCorrection request/approval workflow (a later
// milestone) — PROJECT.md is explicit that direct status edits after
// creation aren't allowed, even for the roles that could otherwise touch
// this record.
export const updateAttendanceSchema = z
  .object({
    method: attendanceMethod,
  })
  .strict();

export const listAttendanceQuerySchema = z
  .object({
    date: dateOnly.optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    employeeId: z.string().uuid().optional(),
    storeId: z.string().uuid().optional(),
    status: attendanceStatus.optional(),
  })
  .strict();
