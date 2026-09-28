import { z } from "zod";

const attendanceStatus = z.enum(["PRESENT", "ABSENT"]);
const correctionStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]);

// Same UTC-safe date-only pattern established in the Attendance module —
// z.string().date() locks the format to "YYYY-MM-DD" before constructing
// a Date, avoiding the local-timezone-parsing trap a looser coercion would
// allow.
const dateOnly = z
  .string()
  .date()
  .transform((value) => new Date(value));

export const createCorrectionSchema = z
  .object({
    attendanceId: z.string().uuid(),
    proposedStatus: attendanceStatus,
    reason: z.string().trim().min(1),
  })
  .strict();

export const listCorrectionsQuerySchema = z
  .object({
    status: correctionStatus.optional(),
    employeeId: z.string().uuid().optional(),
    attendanceId: z.string().uuid().optional(),
    storeId: z.string().uuid().optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
  })
  .strict();
