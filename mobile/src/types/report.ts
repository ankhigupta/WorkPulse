// Mirrors backend/src/modules/reports/reports.service.ts's four return
// shapes exactly, read from source directly (not assumed). Every
// `employeeName` is the real Employee.name (never derived from email) —
// the backend's own comment says as much. Monetary fields are pre-
// formatted 2-decimal strings via Prisma.Decimal#toFixed(2), never numbers.

export interface ReportPeriod {
  startDate: string;
  endDate: string;
}

// Attendance report rows are PER-EMPLOYEE AGGREGATES over the period
// (prisma.attendance.groupBy present/absent counts) — there is no
// per-record method, date, or check-in time anywhere in this response,
// unlike the Attendance module's own day-by-day record list.
export interface AttendanceReportRow {
  employeeId: string;
  employeeName: string;
  storeId: string;
  storeName: string;
  present: number;
  absent: number;
  total: number;
  attendanceRate: number;
}

export interface AttendanceReport {
  period: ReportPeriod;
  summary: { present: number; absent: number; total: number; attendanceRate: number };
  employees: AttendanceReportRow[];
}

export interface AttendanceReportParams {
  startDate: string;
  endDate: string;
  employeeId?: string;
  storeId?: string;
}

export type PayrollReportStatus = "DRAFT" | "FINALIZED";

export interface PayrollReportRow {
  payrollId: string;
  employeeId: string;
  employeeName: string;
  storeId: string;
  storeName: string;
  periodStart: string;
  periodEnd: string;
  totalWage: string;
  status: PayrollReportStatus;
}

export interface PayrollReport {
  period: ReportPeriod;
  summary: { draftTotal: string; finalizedTotal: string; recordCount: number };
  payroll: PayrollReportRow[];
}

export interface PayrollReportParams {
  startDate: string;
  endDate: string;
  employeeId?: string;
  storeId?: string;
  status?: PayrollReportStatus;
}

export interface PaymentsReportRow {
  paymentId: string;
  employeeId: string;
  employeeName: string;
  storeId: string;
  storeName: string;
  amount: string;
  // A genuine instant (record.paidAt.toISOString()), not date-only.
  paidAt: string;
  note: string | null;
}

export interface PaymentsReport {
  period: ReportPeriod;
  summary: { totalPaid: string; paymentCount: number };
  payments: PaymentsReportRow[];
}

// No storeId filter exists on this endpoint at all — confirmed against
// paymentsReportQuerySchema, not assumed. Never show a store picker here.
export interface PaymentsReportParams {
  startDate: string;
  endDate: string;
  employeeId?: string;
}

export interface WorkforceReportRow {
  employeeId: string;
  employeeName: string;
  storeId: string;
  storeName: string;
  dailyWage: string;
  joinedAt: string;
  isActive: boolean;
}

export interface WorkforceReport {
  summary: { totalEmployees: number; activeEmployees: number; inactiveEmployees: number };
  employees: WorkforceReportRow[];
}

export interface WorkforceReportParams {
  storeId?: string;
  // Query params are always strings on the wire — the backend's own
  // schema parses "true"/"false" explicitly. Sent as a real boolean here;
  // api/reports.ts converts it to that string right before the request.
  activeOnly?: boolean;
}
