import { z } from "zod";

// Same UTC-safe date-only pattern established in Attendance/Payroll/Payments.
const dateOnly = z
  .string()
  .date()
  .transform((value) => new Date(value));

export const dashboardSummaryQuerySchema = z
  .object({
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
  })
  .strict()
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });
