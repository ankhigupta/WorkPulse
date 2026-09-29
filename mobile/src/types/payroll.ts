export type PayrollStatus = "DRAFT" | "FINALIZED";

// Mirrors backend/src/modules/payroll/payroll.service.ts's payrollSelect
// exactly. No employee/store name (same pattern as Attendance/Corrections
// — resolved client-side from the already-loaded employee/store lists).
// finalizedByUserId is a raw actor id with no endpoint anywhere that
// resolves it to a name, so the mobile UI never tries to show "finalized
// by X" — only "finalized at" (a real, displayable timestamp).
export interface Payroll {
  id: string;
  employeeId: string;
  storeId: string;
  organizationId: string;
  // Raw Prisma DateTime columns, never reformatted server-side — arrive as
  // full ISO strings, not "YYYY-MM-DD". Pass through toDateOnlyString.
  periodStart: string;
  periodEnd: string;
  totalDaysPresent: number;
  // Prisma.Decimal serializes to a JSON string — never parse this into a
  // JS number for anything beyond display formatting.
  totalWage: string;
  status: PayrollStatus;
  generatedAt: string;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mirrors listPayrollQuerySchema. periodStart/periodEnd filter the
// payroll's own period fields ("periods starting on/after X" / "ending
// on/before Y"), not an Attendance.date range.
export interface ListPayrollParams {
  employeeId?: string;
  storeId?: string;
  status?: PayrollStatus;
  periodStart?: string;
  periodEnd?: string;
}

// Mirrors createPayrollSchema exactly — totalWage/totalDaysPresent are
// never client-supplied, the backend calculator produces both.
export interface CreatePayrollInput {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
}
