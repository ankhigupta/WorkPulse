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

// STORE_MANAGER may only ever touch `method` — status changes for this
// role go through the separate AttendanceCorrection request/approval
// workflow. `.strict()` means a STORE_MANAGER sending `status` here gets a
// 422 for an unrecognized field, not a silent ignore — the schema itself
// is already half of "the backend must enforce only ORGANIZATION_ADMIN
// can directly mutate status," not just the route-level role check.
export const updateAttendanceAsStoreManagerSchema = z
  .object({
    method: attendanceMethod,
  })
  .strict();

// ORGANIZATION_ADMIN has direct authority over attendance: `status` is
// editable here (PRESENT <-> ABSENT), updating the existing row in place.
// No AttendanceCorrection is created by this path — see
// attendance.service.ts's updateAttendanceForAuth.
export const updateAttendanceAsOrgAdminSchema = z
  .object({
    method: attendanceMethod.optional(),
    status: attendanceStatus.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

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
