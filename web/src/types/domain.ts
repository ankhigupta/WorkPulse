// Every type here mirrors an actual backend `select` clause. No field
// exists in this file that the API does not really return.

export type Role = "SUPER_ADMIN" | "ORGANIZATION_ADMIN" | "STORE_MANAGER" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

export interface CurrentUser extends AuthUser {
  isActive: boolean;
  createdAt: string;
}

/** Web login/signup: the refresh token is an httpOnly cookie, never in the body. */
export interface WebSessionResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Organization {
  id: string;
  name: string;
  isActive: boolean;
  joinCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Nullable — an Employee may exist with no login account at all. */
export interface LinkedUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface Employee {
  id: string;
  organizationId: string;
  storeId: string;
  name: string;
  dailyWage: string;
  qrCodeToken: string;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: LinkedUser | null;
}

export interface Manager {
  id: string;
  organizationId: string;
  storeId: string;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: LinkedUser;
}

export type AttendanceStatus = "PRESENT" | "ABSENT";
export type AttendanceMethod = "QR" | "MANUAL";

export interface Attendance {
  id: string;
  employeeId: string;
  storeId: string;
  organizationId: string;
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checkInAt: string | null;
  markedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AttendanceCorrection {
  id: string;
  attendanceId: string;
  organizationId: string;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  proposedStatus: AttendanceStatus;
  reason: string;
  status: CorrectionStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PayrollStatus = "DRAFT" | "FINALIZED";

export interface Payroll {
  id: string;
  employeeId: string;
  storeId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalDaysPresent: number;
  totalWage: string;
  status: PayrollStatus;
  generatedAt: string;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  employeeId: string;
  organizationId: string;
  amount: string;
  paidAt: string;
  note: string | null;
  recordedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Decimal strings. totalOwed counts FINALIZED payroll only — drafts never. */
export interface EmployeeBalance {
  totalOwed: string;
  totalPaid: string;
  outstanding: string;
}

export interface EmployeeNote {
  id: string;
  employeeId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RequestedRole = "EMPLOYEE" | "STORE_MANAGER";

export interface AccessRequest {
  id: string;
  organizationId: string;
  email: string;
  requestedRole: Role;
  requestedName: string;
  status: AccessRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  period: { startDate: string; endDate: string };
  organization: { id: string; name: string };
  stores: { total: number; active: number };
  employees: { total: number; active: number };
  managers: { total: number; active: number };
  attendance: { present: number; absent: number; total: number; attendanceRate: number };
  payroll: { finalizedTotal: string; draftTotal: string };
  payments: { totalPaid: string; totalOutstanding: string };
}

export interface AttendanceReport {
  period: { startDate: string; endDate: string };
  summary: { present: number; absent: number; total: number; attendanceRate: number };
  employees: {
    employeeId: string;
    employeeName: string;
    storeId: string;
    storeName: string;
    present: number;
    absent: number;
    total: number;
    attendanceRate: number;
  }[];
}

export interface PayrollReport {
  period: { startDate: string; endDate: string };
  summary: { draftTotal: string; finalizedTotal: string; recordCount: number };
  payroll: {
    payrollId: string;
    employeeId: string;
    employeeName: string;
    storeId: string;
    storeName: string;
    periodStart: string;
    periodEnd: string;
    totalWage: string;
    status: PayrollStatus;
  }[];
}

export interface PaymentsReport {
  period: { startDate: string; endDate: string };
  summary: { totalPaid: string; paymentCount: number };
  payments: {
    paymentId: string;
    employeeId: string;
    employeeName: string;
    storeId: string;
    storeName: string;
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
}

export interface WorkforceReport {
  summary: { totalEmployees: number; activeEmployees: number; inactiveEmployees: number };
  employees: {
    employeeId: string;
    employeeName: string;
    storeId: string;
    storeName: string;
    dailyWage: string;
    joinedAt: string;
    isActive: boolean;
  }[];
}
