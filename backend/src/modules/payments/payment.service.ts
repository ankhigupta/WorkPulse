import { prisma } from "../../common/db/prisma";
import { ConflictError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import type { AuthContext } from "../../types/express";
import { getEmployeeForAuth } from "../employees/employee.service";
import { calculateEmployeeBalance } from "./payment.calculator";

const paymentSelect = {
  id: true,
  employeeId: true,
  organizationId: true,
  amount: true,
  paidAt: true,
  note: true,
  recordedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface CreatePaymentInput {
  employeeId: string;
  amount: number;
  paidAt: Date;
  note?: string;
}

export async function createPayment(auth: AuthContext, data: CreatePaymentInput) {
  // Reuses the Employees module's org-scoped accessibility check — an
  // employee outside the caller's organization is simply "not found".
  const employee = await getEmployeeForAuth(auth, data.employeeId);

  const amount = new Prisma.Decimal(data.amount);

  return prisma.$transaction(async (tx) => {
    // Serializes concurrent payment creation per employee. Without this,
    // two simultaneous payments could each read the same outstanding
    // balance before either commits, both pass the overpayment check
    // below, and together exceed it — the aggregate-then-insert shape of
    // this operation isn't protected by a single conditional UPDATE the
    // way AttendanceCorrection/Payroll's state transitions are. The lock
    // is transaction-scoped (pg_advisory_xact_lock) and releases
    // automatically on commit or rollback; hashtext() turns the
    // employee's UUID into a lock key so only payments for the *same*
    // employee ever contend with each other.
    // $executeRaw, not $queryRaw: pg_advisory_xact_lock returns void, and
    // Prisma's $queryRaw fails trying to deserialize a void-typed result
    // column. $executeRaw just runs the statement, no result-set
    // deserialization attempted — confirmed by reproducing the failure
    // directly before switching.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employee.id}))`;

    // Confirmed with the user before implementation: overpayment is
    // rejected, not allowed or carried forward as a credit.
    const { outstanding } = await calculateEmployeeBalance(employee.id, tx);
    if (amount.greaterThan(outstanding)) {
      throw new ConflictError(
        `Payment of ${amount.toString()} would exceed the outstanding balance of ${outstanding.toString()}`,
      );
    }

    return tx.paymentLedger.create({
      data: {
        employeeId: employee.id,
        organizationId: employee.organizationId,
        amount,
        paidAt: data.paidAt,
        note: data.note,
        recordedByUserId: auth.userId,
      },
      select: paymentSelect,
    });
  });
}

export interface ListPaymentFilters {
  employeeId?: string;
  startDate?: Date;
  endDate?: Date;
}

export async function listPaymentsForAuth(auth: AuthContext, filters: ListPaymentFilters) {
  const where: Prisma.PaymentLedgerWhereInput = { organizationId: auth.organizationId! };

  if (filters.employeeId) where.employeeId = filters.employeeId;

  if (filters.startDate || filters.endDate) {
    where.paidAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  return prisma.paymentLedger.findMany({
    where,
    select: paymentSelect,
    orderBy: { paidAt: "desc" },
  });
}

export async function getPaymentForAuth(auth: AuthContext, paymentId: string) {
  const payment = await prisma.paymentLedger.findFirst({
    where: { id: paymentId, organizationId: auth.organizationId! },
    select: paymentSelect,
  });

  if (!payment) {
    throw new NotFoundError("Payment not found");
  }

  return payment;
}

export async function getEmployeeBalanceForAuth(auth: AuthContext, employeeId: string) {
  // Same org-scoped accessibility check as everywhere else — a balance
  // for an inaccessible employee is 404, not a leaked financial figure.
  const employee = await getEmployeeForAuth(auth, employeeId);
  return calculateEmployeeBalance(employee.id);
}
