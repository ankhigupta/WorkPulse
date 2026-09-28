import { prisma } from "../../common/db/prisma";
import { Prisma } from "../../generated/prisma/client";

export interface PayrollCalculation {
  totalDaysPresent: number;
  totalWage: Prisma.Decimal;
}

// The one place the payroll formula lives — confirmed with the user before
// implementation rather than inferred silently.
//
// totalWage = dailyWage × count(Attendance rows with status=PRESENT whose
// date falls within [periodStart, periodEnd]).
//
// A day with no Attendance record at all (a weekend, a day before the
// employee joined, a day nobody marked) is simply not counted — exactly
// like an explicit ABSENT. That single rule is what makes weekends,
// non-working days, and an employee joining mid-period all resolve
// correctly on their own: there's no separate "is this a working day" or
// "joinedAt boundary" concept needed, because only rows that exist AND
// are PRESENT ever get counted.
//
// Attendance.status is read directly, not correction history: an approved
// AttendanceCorrection already updates Attendance.status (see the
// AttendanceCorrection module), so Attendance is already the up-to-date
// source of truth. A rejected or still-PENDING correction never touches
// Attendance.status, so it has no effect on this calculation either —
// nothing extra needs to be done here to respect that.
export async function calculatePayroll(
  employeeId: string,
  dailyWage: Prisma.Decimal,
  periodStart: Date,
  periodEnd: Date,
): Promise<PayrollCalculation> {
  const totalDaysPresent = await prisma.attendance.count({
    where: {
      employeeId,
      status: "PRESENT",
      date: { gte: periodStart, lte: periodEnd },
    },
  });

  // Prisma.Decimal arithmetic, not JS floating point — exact for
  // financial values, verified empirically before writing this.
  const totalWage = dailyWage.times(totalDaysPresent);

  return { totalDaysPresent, totalWage };
}
