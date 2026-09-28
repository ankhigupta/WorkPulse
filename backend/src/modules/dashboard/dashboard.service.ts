import { prisma } from "../../common/db/prisma";
import { Prisma } from "../../generated/prisma/client";
import { PayrollStatus, Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";
import { resolveManagerStoreId } from "../employees/employee.service";

interface DashboardFilters {
  startDate?: Date;
  endDate?: Date;
}

function currentCalendarMonth(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Day 0 of "next month" is the last day of the current month — UTC-anchored,
  // same safe construction technique used for the period boundaries below.
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { startDate, endDate };
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getDashboardSummary(auth: AuthContext, filters: DashboardFilters) {
  // Partial ranges (only one of startDate/endDate) fall back to the full
  // default period rather than guessing an open-ended range — "don't
  // invent complicated date semantics."
  const { startDate, endDate } =
    filters.startDate && filters.endDate
      ? { startDate: filters.startDate, endDate: filters.endDate }
      : currentCalendarMonth();

  const organizationId = auth.organizationId!;

  // STORE_MANAGER's store isn't a JWT claim — resolved fresh from the
  // Manager row, reusing the exact same helper every other module already
  // uses. If no Manager row exists for this user, it throws
  // ForbiddenError, which is this application's established behavior for
  // that situation — no silent fallback to org-wide data.
  const storeId = auth.role === Role.STORE_MANAGER ? await resolveManagerStoreId(auth.userId) : undefined;

  const storeScope: Prisma.StoreWhereInput = { organizationId, ...(storeId ? { id: storeId } : {}) };
  const employeeScope: Prisma.EmployeeWhereInput = { organizationId, ...(storeId ? { storeId } : {}) };
  const managerScope: Prisma.ManagerWhereInput = { organizationId, ...(storeId ? { storeId } : {}) };

  // Attendance and Payroll each carry their own storeId snapshot (set at
  // creation, independent of the employee's *current* store) — filtered
  // directly, not via the employee relation, so a record stays correctly
  // attributed to the store it actually happened at even if the employee
  // is later reassigned elsewhere. This is the same historical-integrity
  // reasoning the schema was built around.
  const attendancePeriodScope: Prisma.AttendanceWhereInput = {
    organizationId,
    ...(storeId ? { storeId } : {}),
    date: { gte: startDate, lte: endDate },
  };
  const payrollPeriodScope: Prisma.PayrollWhereInput = {
    organizationId,
    ...(storeId ? { storeId } : {}),
    periodStart: { lte: endDate },
    periodEnd: { gte: startDate },
  };

  // PaymentLedger has no storeId column of its own (confirmed against the
  // schema before writing this) — scoped via the employee's *current*
  // store, the only relationship available, exactly as anticipated.
  const paymentPeriodScope: Prisma.PaymentLedgerWhereInput = {
    organizationId,
    ...(storeId ? { employee: { storeId } } : {}),
    paidAt: { gte: startDate, lte: endDate },
  };

  // All-time (never period-filtered) scope for the outstanding-balance
  // figure — reuses the exact rule already established in the Payment
  // Ledger milestone's calculator: what's currently owed has to include
  // finalized payroll and payments from any point in history, not just
  // whatever window the dashboard happens to be showing.
  const finalizedPayrollAllTimeScope: Prisma.PayrollWhereInput = {
    organizationId,
    ...(storeId ? { storeId } : {}),
    status: PayrollStatus.FINALIZED,
  };
  const paymentAllTimeScope: Prisma.PaymentLedgerWhereInput = {
    organizationId,
    ...(storeId ? { employee: { storeId } } : {}),
  };

  const [
    organization,
    storesTotal,
    storesActive,
    employeesTotal,
    employeesActive,
    managersTotal,
    managersActive,
    presentCount,
    absentCount,
    payrollFinalizedAgg,
    payrollDraftAgg,
    paymentsPeriodAgg,
    allTimeFinalizedAgg,
    allTimePaidAgg,
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true } }),
    prisma.store.count({ where: storeScope }),
    prisma.store.count({ where: { ...storeScope, isActive: true } }),
    prisma.employee.count({ where: employeeScope }),
    prisma.employee.count({ where: { ...employeeScope, isActive: true } }),
    prisma.manager.count({ where: managerScope }),
    prisma.manager.count({ where: { ...managerScope, isActive: true } }),
    prisma.attendance.count({ where: { ...attendancePeriodScope, status: "PRESENT" } }),
    prisma.attendance.count({ where: { ...attendancePeriodScope, status: "ABSENT" } }),
    prisma.payroll.aggregate({
      where: { ...payrollPeriodScope, status: PayrollStatus.FINALIZED },
      _sum: { totalWage: true },
    }),
    prisma.payroll.aggregate({
      where: { ...payrollPeriodScope, status: PayrollStatus.DRAFT },
      _sum: { totalWage: true },
    }),
    prisma.paymentLedger.aggregate({ where: paymentPeriodScope, _sum: { amount: true } }),
    prisma.payroll.aggregate({ where: finalizedPayrollAllTimeScope, _sum: { totalWage: true } }),
    prisma.paymentLedger.aggregate({ where: paymentAllTimeScope, _sum: { amount: true } }),
  ]);

  const totalAttendance = presentCount + absentCount;
  // Never NaN/Infinity: guarded explicitly for the zero-attendance case,
  // per the ticket's requirement — not just "happens to not divide by
  // zero" by luck.
  const attendanceRate =
    totalAttendance === 0 ? 0 : Math.round((presentCount / totalAttendance) * 10000) / 100;

  const finalizedTotal = payrollFinalizedAgg._sum.totalWage ?? new Prisma.Decimal(0);
  const draftTotal = payrollDraftAgg._sum.totalWage ?? new Prisma.Decimal(0);
  const totalPaid = paymentsPeriodAgg._sum.amount ?? new Prisma.Decimal(0);

  const allTimeFinalized = allTimeFinalizedAgg._sum.totalWage ?? new Prisma.Decimal(0);
  const allTimePaid = allTimePaidAgg._sum.amount ?? new Prisma.Decimal(0);
  // Decimal arithmetic, not JS floating point — same discipline as
  // Payroll/Payments.
  const totalOutstanding = allTimeFinalized.minus(allTimePaid);

  return {
    period: { startDate: formatDateOnly(startDate), endDate: formatDateOnly(endDate) },
    organization,
    stores: { total: storesTotal, active: storesActive },
    employees: { total: employeesTotal, active: employeesActive },
    managers: { total: managersTotal, active: managersActive },
    attendance: {
      present: presentCount,
      absent: absentCount,
      total: totalAttendance,
      attendanceRate,
    },
    payroll: {
      finalizedTotal: finalizedTotal.toString(),
      draftTotal: draftTotal.toString(),
    },
    payments: {
      totalPaid: totalPaid.toString(),
      totalOutstanding: totalOutstanding.toString(),
    },
  };
}
