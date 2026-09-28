import { prisma } from "../../common/db/prisma";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";
import { resolveManagerStoreId } from "../employees/employee.service";

// Shared by all four reports — STORE_MANAGER's store isn't a JWT claim,
// resolved fresh from their Manager row via the same helper every other
// module already uses. No Manager row → the helper itself throws
// ForbiddenError, matching Dashboard's established behavior for this case.
async function resolveScope(auth: AuthContext): Promise<{ organizationId: string; storeId?: string }> {
  const organizationId = auth.organizationId!;
  const storeId = auth.role === Role.STORE_MANAGER ? await resolveManagerStoreId(auth.userId) : undefined;
  return { organizationId, storeId };
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeRate(present: number, total: number): number {
  return total === 0 ? 0 : Math.round((present / total) * 10000) / 100;
}

// Every "employeeName" field is Employee.name — a real, independent
// workforce identity. It has no relationship to whether the employee has
// a login account at all; an employee with no User still has a name.

// ── Report 1: Attendance ──────────────────────────────────────────

export interface AttendanceReportFilters {
  startDate: Date;
  endDate: Date;
  employeeId?: string;
  storeId?: string;
}

export async function getAttendanceReport(auth: AuthContext, filters: AttendanceReportFilters) {
  const { organizationId, storeId: managerStoreId } = await resolveScope(auth);
  // A client-supplied storeId is only ever honored for ORGANIZATION_ADMIN,
  // as an additional narrowing filter — for STORE_MANAGER their own
  // resolved store always wins, the client value has no effect.
  const storeId = managerStoreId ?? filters.storeId;

  // Attendance.storeId is its own stored snapshot, filtered directly (not
  // via the employee relation) so historical records stay correctly
  // attributed even if the employee is later reassigned to another store.
  const where: Prisma.AttendanceWhereInput = {
    organizationId,
    ...(storeId ? { storeId } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    date: { gte: filters.startDate, lte: filters.endDate },
  };

  const grouped = await prisma.attendance.groupBy({
    by: ["employeeId", "status"],
    where,
    _count: { _all: true },
  });

  const employeeIds = [...new Set(grouped.map((row) => row.employeeId))];
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: {
          id: true,
          name: true,
          storeId: true,
          store: { select: { name: true } },
        },
      })
    : [];
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const perEmployee = new Map<string, { present: number; absent: number }>();
  for (const row of grouped) {
    const entry = perEmployee.get(row.employeeId) ?? { present: 0, absent: 0 };
    if (row.status === "PRESENT") entry.present += row._count._all;
    else entry.absent += row._count._all;
    perEmployee.set(row.employeeId, entry);
  }

  let summaryPresent = 0;
  let summaryAbsent = 0;

  const employeeRows = [...perEmployee.entries()].map(([employeeId, counts]) => {
    summaryPresent += counts.present;
    summaryAbsent += counts.absent;
    const employee = employeeById.get(employeeId);
    const total = counts.present + counts.absent;
    return {
      employeeId,
      employeeName: employee?.name ?? "",
      storeId: employee?.storeId ?? "",
      storeName: employee?.store.name ?? "",
      present: counts.present,
      absent: counts.absent,
      total,
      attendanceRate: computeRate(counts.present, total),
    };
  });

  const summaryTotal = summaryPresent + summaryAbsent;

  return {
    period: { startDate: formatDateOnly(filters.startDate), endDate: formatDateOnly(filters.endDate) },
    summary: {
      present: summaryPresent,
      absent: summaryAbsent,
      total: summaryTotal,
      attendanceRate: computeRate(summaryPresent, summaryTotal),
    },
    employees: employeeRows,
  };
}

// ── Report 2: Payroll ──────────────────────────────────────────────

export interface PayrollReportFilters {
  startDate: Date;
  endDate: Date;
  employeeId?: string;
  storeId?: string;
  status?: "DRAFT" | "FINALIZED";
}

export async function getPayrollReport(auth: AuthContext, filters: PayrollReportFilters) {
  const { organizationId, storeId: managerStoreId } = await resolveScope(auth);
  const storeId = managerStoreId ?? filters.storeId;

  // Payroll.storeId is its own stored snapshot too — same reasoning as
  // Attendance. Period selection uses interval overlap (inclusive), not
  // an exact match, since a payroll period rarely aligns exactly with an
  // arbitrary report window.
  const baseWhere: Prisma.PayrollWhereInput = {
    organizationId,
    ...(storeId ? { storeId } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    periodStart: { lte: filters.endDate },
    periodEnd: { gte: filters.startDate },
  };
  const listWhere: Prisma.PayrollWhereInput = {
    ...baseWhere,
    ...(filters.status ? { status: filters.status } : {}),
  };

  // Each status aggregate skips its own query entirely (rather than
  // spreading `status` from `listWhere` and overriding it) when the
  // client's status filter rules that status out — spreading-then-
  // overriding `status` on top of `listWhere` would silently discard the
  // client's own filter and compute the total across the *whole* scope
  // regardless of what they asked for. Caught by a test expecting
  // finalizedTotal to be "0.00" under a status=DRAFT filter.
  const draftWhere = !filters.status || filters.status === "DRAFT" ? { ...baseWhere, status: "DRAFT" as const } : null;
  const finalizedWhere =
    !filters.status || filters.status === "FINALIZED" ? { ...baseWhere, status: "FINALIZED" as const } : null;

  const [draftAgg, finalizedAgg, recordCount, records] = await Promise.all([
    draftWhere
      ? prisma.payroll.aggregate({ where: draftWhere, _sum: { totalWage: true } })
      : Promise.resolve({ _sum: { totalWage: null as Prisma.Decimal | null } }),
    finalizedWhere
      ? prisma.payroll.aggregate({ where: finalizedWhere, _sum: { totalWage: true } })
      : Promise.resolve({ _sum: { totalWage: null as Prisma.Decimal | null } }),
    prisma.payroll.count({ where: listWhere }),
    prisma.payroll.findMany({
      where: listWhere,
      select: {
        id: true,
        employeeId: true,
        storeId: true,
        periodStart: true,
        periodEnd: true,
        totalWage: true,
        status: true,
        store: { select: { name: true } },
        employee: { select: { name: true } },
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    period: { startDate: formatDateOnly(filters.startDate), endDate: formatDateOnly(filters.endDate) },
    summary: {
      draftTotal: (draftAgg._sum.totalWage ?? new Prisma.Decimal(0)).toFixed(2),
      finalizedTotal: (finalizedAgg._sum.totalWage ?? new Prisma.Decimal(0)).toFixed(2),
      recordCount,
    },
    payroll: records.map((record) => ({
      payrollId: record.id,
      employeeId: record.employeeId,
      employeeName: record.employee.name,
      storeId: record.storeId,
      storeName: record.store.name,
      periodStart: formatDateOnly(record.periodStart),
      periodEnd: formatDateOnly(record.periodEnd),
      totalWage: record.totalWage.toFixed(2),
      status: record.status,
    })),
  };
}

// ── Report 3: Payments ──────────────────────────────────────────────

export interface PaymentsReportFilters {
  startDate: Date;
  endDate: Date;
  employeeId?: string;
}

function startOfDayAfter(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export async function getPaymentsReport(auth: AuthContext, filters: PaymentsReportFilters) {
  const { organizationId, storeId } = await resolveScope(auth);

  // PaymentLedger has no storeId column — scoped through Employee -> Store,
  // the only relationship available (confirmed against the schema).
  const where: Prisma.PaymentLedgerWhereInput = {
    organizationId,
    ...(storeId ? { employee: { storeId } } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    // paidAt is a full DateTime, not a date-only field — gte startDate and
    // a strictly-less-than the day *after* endDate, so a payment recorded
    // at any time on the end date is included, not truncated at midnight.
    paidAt: { gte: filters.startDate, lt: startOfDayAfter(filters.endDate) },
  };

  const [totalAgg, paymentCount, records] = await Promise.all([
    prisma.paymentLedger.aggregate({ where, _sum: { amount: true } }),
    prisma.paymentLedger.count({ where }),
    prisma.paymentLedger.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        amount: true,
        paidAt: true,
        note: true,
        employee: {
          select: { name: true, storeId: true, store: { select: { name: true } } },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  return {
    period: { startDate: formatDateOnly(filters.startDate), endDate: formatDateOnly(filters.endDate) },
    summary: {
      totalPaid: (totalAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      paymentCount,
    },
    payments: records.map((record) => ({
      paymentId: record.id,
      employeeId: record.employeeId,
      employeeName: record.employee.name,
      storeId: record.employee.storeId,
      storeName: record.employee.store.name,
      amount: record.amount.toFixed(2),
      paidAt: record.paidAt.toISOString(),
      note: record.note,
    })),
  };
}

// ── Report 4: Workforce ─────────────────────────────────────────────

export interface WorkforceReportFilters {
  storeId?: string;
  activeOnly: boolean;
}

export async function getWorkforceReport(auth: AuthContext, filters: WorkforceReportFilters) {
  const { organizationId, storeId: managerStoreId } = await resolveScope(auth);
  const storeId = managerStoreId ?? filters.storeId;

  const baseWhere: Prisma.EmployeeWhereInput = { organizationId, ...(storeId ? { storeId } : {}) };

  const [totalEmployees, activeEmployees, records] = await Promise.all([
    prisma.employee.count({ where: baseWhere }),
    prisma.employee.count({ where: { ...baseWhere, isActive: true } }),
    prisma.employee.findMany({
      where: { ...baseWhere, ...(filters.activeOnly ? { isActive: true } : {}) },
      // Explicit select, not include — passwordHash/refreshTokens/other
      // sensitive User fields are never fetched in the first place, not
      // fetched-then-stripped.
      select: {
        id: true,
        name: true,
        storeId: true,
        dailyWage: true,
        joinedAt: true,
        isActive: true,
        store: { select: { name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return {
    summary: {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
    },
    employees: records.map((record) => ({
      employeeId: record.id,
      employeeName: record.name,
      storeId: record.storeId,
      storeName: record.store.name,
      dailyWage: record.dailyWage.toFixed(2),
      joinedAt: formatDateOnly(record.joinedAt),
      isActive: record.isActive,
    })),
  };
}
