import { prisma } from "../../common/db/prisma";
import { Prisma } from "../../generated/prisma/client";
import { PayrollStatus } from "../../generated/prisma/enums";

export interface EmployeeBalance {
  totalOwed: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  outstanding: Prisma.Decimal;
}

type Db = typeof prisma | Prisma.TransactionClient;

// Outstanding balance is always computed at query time from the two
// underlying sources of truth — never stored, per the schema's own
// documented intent (see the comment above PaymentLedger in schema.prisma).
//
// Only FINALIZED payroll counts as a real liability. DRAFT payroll is
// provisional and can still be recalculated/changed, so counting it here
// would let a still-editable, unlocked number affect what an employee is
// told they're owed.
//
// Accepts an optional transaction client so the overpayment check in
// payment.service.ts can reuse this exact logic inside the same
// transaction as the write it's guarding, instead of duplicating it.
export async function calculateEmployeeBalance(
  employeeId: string,
  db: Db = prisma,
): Promise<EmployeeBalance> {
  const [payrollAgg, paymentAgg] = await Promise.all([
    db.payroll.aggregate({
      where: { employeeId, status: PayrollStatus.FINALIZED },
      _sum: { totalWage: true },
    }),
    db.paymentLedger.aggregate({
      where: { employeeId },
      _sum: { amount: true },
    }),
  ]);

  const totalOwed = payrollAgg._sum.totalWage ?? new Prisma.Decimal(0);
  const totalPaid = paymentAgg._sum.amount ?? new Prisma.Decimal(0);
  const outstanding = totalOwed.minus(totalPaid);

  return { totalOwed, totalPaid, outstanding };
}
