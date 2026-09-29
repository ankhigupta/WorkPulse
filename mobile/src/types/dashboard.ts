// Mirrors backend/src/modules/dashboard/dashboard.service.ts's return shape
// exactly (read from source, not assumed). Monetary fields are decimal
// strings (Prisma.Decimal serializes to JSON as a string), never numbers.
export interface DashboardSummary {
  period: { startDate: string; endDate: string };
  organization: { id: string; name: string };
  stores: { total: number; active: number };
  employees: { total: number; active: number };
  managers: { total: number; active: number };
  attendance: {
    present: number;
    absent: number;
    total: number;
    attendanceRate: number;
  };
  payroll: { finalizedTotal: string; draftTotal: string };
  payments: { totalPaid: string; totalOutstanding: string };
}

// startDate/endDate are YYYY-MM-DD; omitting both makes the backend default
// to the current calendar month (dashboard.schemas.ts's dateOnly pattern).
export interface DashboardSummaryParams {
  startDate?: string;
  endDate?: string;
}
