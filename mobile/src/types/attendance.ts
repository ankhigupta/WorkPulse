// Mirrors backend/src/generated/prisma/enums.ts exactly. The backend only
// ever models these two statuses — do not add LATE/ON_LEAVE/HALF_DAY here;
// status changes beyond these two go through the (not-yet-built) Attendance
// Corrections workflow, never a direct value added to this union.
export type AttendanceStatus = "PRESENT" | "ABSENT";

// QR capture isn't implemented on mobile yet (no scanner) — MANUAL is the
// only method this app ever writes, though QR records created elsewhere
// (e.g. a future in-store device) can still be read and displayed.
export type AttendanceMethod = "QR" | "MANUAL";

// Mirrors backend/src/modules/attendance/attendance.service.ts's
// attendanceSelect exactly — note there is no nested employee/store name,
// only the raw ids. The mobile UI resolves names from the already-loaded
// employee/store lists rather than the backend adding a join.
export interface Attendance {
  id: string;
  employeeId: string;
  storeId: string;
  organizationId: string;
  // A raw Prisma DateTime column, never reformatted server-side — arrives
  // as a full ISO string ("2026-01-15T00:00:00.000Z"), not "YYYY-MM-DD".
  // Always pass through utils/format.ts's toDateOnlyString before display
  // or comparison against a selected-date string.
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checkInAt: string | null;
  markedByUserId: string;
  // Set only once `status` has been changed after creation — by an
  // ORGANIZATION_ADMIN direct edit or an approved AttendanceCorrection.
  // Both null until either happens for the first time.
  statusChangedByUserId: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mirrors listAttendanceQuerySchema. date/startDate/endDate must be plain
// YYYY-MM-DD strings — the backend's z.string().date() rejects anything else.
export interface ListAttendanceParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  storeId?: string;
  status?: AttendanceStatus;
}

// Mirrors createAttendanceSchema. organizationId/storeId/markedByUserId are
// deliberately absent — the backend derives all three from the employee
// record and the authenticated caller; there is nothing here for a client
// to override even if it tried.
export interface CreateAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checkInAt?: string;
}

// ORGANIZATION_ADMIN only — mirrors updateAttendanceAsOrgAdminSchema's
// `status` field. The backend independently enforces this is admin-only
// even though only the admin-facing screen ever sends it.
export interface UpdateAttendanceStatusInput {
  status: AttendanceStatus;
}
