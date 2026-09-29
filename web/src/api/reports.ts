import { apiClient } from "./client";
import type {
  AttendanceReport,
  DashboardSummary,
  PayrollReport,
  PaymentsReport,
  PayrollStatus,
  WorkforceReport,
} from "../types/domain";

export async function getDashboardSummary(range?: {
  startDate: string;
  endDate: string;
}): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary", { params: range });
  return data;
}

export async function getAttendanceReport(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
  storeId?: string;
}): Promise<AttendanceReport> {
  const { data } = await apiClient.get<AttendanceReport>("/reports/attendance", { params });
  return data;
}

export async function getPayrollReport(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
  storeId?: string;
  status?: PayrollStatus;
}): Promise<PayrollReport> {
  const { data } = await apiClient.get<PayrollReport>("/reports/payroll", { params });
  return data;
}

export async function getPaymentsReport(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
}): Promise<PaymentsReport> {
  const { data } = await apiClient.get<PaymentsReport>("/reports/payments", { params });
  return data;
}

export async function getWorkforceReport(params: {
  storeId?: string;
  activeOnly?: boolean;
}): Promise<WorkforceReport> {
  const { data } = await apiClient.get<WorkforceReport>("/reports/workforce", {
    params: { ...params, activeOnly: params.activeOnly === undefined ? undefined : String(params.activeOnly) },
  });
  return data;
}
