import { prisma } from "../../common/db/prisma";
import { ConflictError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { PayrollStatus } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";
import { getEmployeeForAuth } from "../employees/employee.service";
import { calculatePayroll } from "./payroll.calculator";

const payrollSelect = {
  id: true,
  employeeId: true,
  storeId: true,
  organizationId: true,
  periodStart: true,
  periodEnd: true,
  totalDaysPresent: true,
  totalWage: true,
  status: true,
  generatedAt: true,
  finalizedAt: true,
  finalizedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

interface CreatePayrollInput {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
}

// Only ORGANIZATION_ADMIN ever reaches this module (route-gated) — payroll
// is financially sensitive and PROJECT.md's dashboards only ever surface
// wage/financial data to Organization Admin, never Store Manager.
export async function createPayroll(auth: AuthContext, data: CreatePayrollInput) {
  // Reuses the Employees module's org-scoped accessibility check — an
  // employee outside the caller's organization is simply "not found".
  const employee = await getEmployeeForAuth(auth, data.employeeId);

  const { totalDaysPresent, totalWage } = await calculatePayroll(
    employee.id,
    employee.dailyWage,
    data.periodStart,
    data.periodEnd,
  );

  try {
    return await prisma.payroll.create({
      data: {
        employeeId: employee.id,
        // storeId is derived from the employee's current store — never
        // client-supplied, same pattern as Attendance.
        storeId: employee.storeId,
        organizationId: employee.organizationId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        totalDaysPresent,
        totalWage,
        status: PayrollStatus.DRAFT,
        generatedAt: new Date(),
      },
      select: payrollSelect,
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("Payroll already exists for this employee and period");
    }
    throw error;
  }
}

export interface ListPayrollFilters {
  employeeId?: string;
  storeId?: string;
  status?: "DRAFT" | "FINALIZED";
  periodStart?: Date;
  periodEnd?: Date;
}

function buildScopedWhere(auth: AuthContext, filters: ListPayrollFilters): Prisma.PayrollWhereInput {
  const where: Prisma.PayrollWhereInput = {
    organizationId: auth.organizationId!,
  };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.storeId) where.storeId = filters.storeId;
  if (filters.status) where.status = filters.status;
  // A window filter on the payroll's own period fields, not a range on
  // Attendance.date — "periods starting on/after X" / "periods ending
  // on/before Y".
  if (filters.periodStart) where.periodStart = { gte: filters.periodStart };
  if (filters.periodEnd) where.periodEnd = { lte: filters.periodEnd };

  return where;
}

export async function listPayrollForAuth(auth: AuthContext, filters: ListPayrollFilters) {
  const where = buildScopedWhere(auth, filters);
  return prisma.payroll.findMany({
    where,
    select: payrollSelect,
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPayrollForAuth(auth: AuthContext, payrollId: string) {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, organizationId: auth.organizationId! },
    select: payrollSelect,
  });

  if (!payroll) {
    throw new NotFoundError("Payroll not found");
  }

  return payroll;
}

async function getOrgPayrollOrThrow(organizationId: string, payrollId: string) {
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, organizationId },
  });

  if (!payroll) {
    throw new NotFoundError("Payroll not found");
  }

  return payroll;
}

// DRAFT payroll can be recalculated — re-reads both current attendance
// state AND the employee's current dailyWage (a raise between creation
// and recalculation should be reflected; only FINALIZED freezes the rate
// permanently). Race-protected the same way AttendanceCorrection's
// approve/reject are: the conditional UPDATE's WHERE clause (not a prior
// read) is what prevents a recalculate racing a concurrent finalize from
// overwriting an amount that's already been locked.
export async function recalculatePayroll(auth: AuthContext, payrollId: string) {
  const payroll = await getOrgPayrollOrThrow(auth.organizationId!, payrollId);

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: payroll.employeeId },
    select: { dailyWage: true },
  });

  const { totalDaysPresent, totalWage } = await calculatePayroll(
    payroll.employeeId,
    employee.dailyWage,
    payroll.periodStart,
    payroll.periodEnd,
  );

  const result = await prisma.payroll.updateMany({
    where: { id: payrollId, status: PayrollStatus.DRAFT },
    data: { totalDaysPresent, totalWage, generatedAt: new Date() },
  });

  if (result.count === 0) {
    throw new ConflictError("Cannot recalculate a finalized payroll record");
  }

  return prisma.payroll.findUniqueOrThrow({ where: { id: payrollId }, select: payrollSelect });
}

// A single conditional UPDATE is already atomic — no explicit transaction
// needed, consistent with AttendanceCorrection's single-write reject path.
// Finalize only locks whatever amount currently exists on the record; it
// does not recalculate (that's what recalculate is for — a separate,
// deliberate action, not an implicit side effect of finalizing).
export async function finalizePayroll(auth: AuthContext, payrollId: string) {
  await getOrgPayrollOrThrow(auth.organizationId!, payrollId);

  const result = await prisma.payroll.updateMany({
    where: { id: payrollId, status: PayrollStatus.DRAFT },
    data: {
      status: PayrollStatus.FINALIZED,
      finalizedAt: new Date(),
      finalizedByUserId: auth.userId,
    },
  });

  if (result.count === 0) {
    throw new ConflictError("This payroll record has already been finalized");
  }

  return prisma.payroll.findUniqueOrThrow({ where: { id: payrollId }, select: payrollSelect });
}
