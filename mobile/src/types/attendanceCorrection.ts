import type { AttendanceStatus } from "./attendance";

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

// Mirrors backend/src/modules/attendanceCorrections/attendanceCorrection.service.ts's
// correctionSelect exactly. Note what's absent: no employeeId, no
// attendance date, no original/current attendance status, no reviewer
// name — only attendanceId and raw actor ids. The mobile UI resolves
// employee/date/current-status by joining against the already-loaded
// Attendance list client-side (see hooks/useAttendanceCorrections.ts);
// requestedByUserId/reviewedByUserId are never resolved to a name because
// there is no endpoint that returns one for an arbitrary user id.
export interface AttendanceCorrection {
  id: string;
  attendanceId: string;
  organizationId: string;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  proposedStatus: AttendanceStatus;
  reason: string;
  status: CorrectionStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mirrors listCorrectionsQuerySchema. startDate/endDate filter via the
// joined Attendance.date (there is no date column on this table itself).
export interface ListCorrectionsParams {
  status?: CorrectionStatus;
  employeeId?: string;
  attendanceId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
}

// Mirrors createCorrectionSchema exactly — the field is `proposedStatus`,
// not "requestedStatus". No organizationId/requestedByUserId: both are
// derived server-side from the authenticated caller and the referenced
// Attendance row.
export interface CreateCorrectionInput {
  attendanceId: string;
  proposedStatus: AttendanceStatus;
  reason: string;
}
