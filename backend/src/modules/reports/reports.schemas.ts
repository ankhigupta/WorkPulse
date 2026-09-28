import { z } from "zod";

// Same UTC-safe date-only pattern established in Attendance/Payroll/Payments/Dashboard.
const dateOnly = z
  .string()
  .date()
  .transform((value) => new Date(value));

const dateRange = {
  startDate: dateOnly,
  endDate: dateOnly,
};

export const attendanceReportQuerySchema = z
  .object({
    ...dateRange,
    employeeId: z.string().uuid().optional(),
    storeId: z.string().uuid().optional(),
  })
  .strict()
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

export const payrollReportQuerySchema = z
  .object({
    ...dateRange,
    employeeId: z.string().uuid().optional(),
    storeId: z.string().uuid().optional(),
    status: z.enum(["DRAFT", "FINALIZED"]).optional(),
  })
  .strict()
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

export const paymentsReportQuerySchema = z
  .object({
    ...dateRange,
    employeeId: z.string().uuid().optional(),
  })
  .strict()
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

export const workforceReportQuerySchema = z
  .object({
    storeId: z.string().uuid().optional(),
    // HTTP query params are always strings — "true"/"false" parsed
    // explicitly, not a bare z.boolean() which would reject any query string.
    activeOnly: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
  })
  .strict();
