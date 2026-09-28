import { z } from "zod";

// Same UTC-safe date-only pattern established in Attendance/AttendanceCorrections.
const dateOnly = z
  .string()
  .date()
  .transform((value) => new Date(value));

export const createPayrollSchema = z
  .object({
    employeeId: z.string().uuid(),
    periodStart: dateOnly,
    periodEnd: dateOnly,
  })
  .strict()
  .refine((data) => data.periodStart <= data.periodEnd, {
    message: "periodStart must be on or before periodEnd",
    path: ["periodEnd"],
  });

export const listPayrollQuerySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    storeId: z.string().uuid().optional(),
    status: z.enum(["DRAFT", "FINALIZED"]).optional(),
    periodStart: dateOnly.optional(),
    periodEnd: dateOnly.optional(),
  })
  .strict();
