import { apiClient } from "./client";
import type {
  AttendanceReport,
  AttendanceReportParams,
  PaymentsReport,
  PaymentsReportParams,
  PayrollReport,
  PayrollReportParams,
  WorkforceReport,
  WorkforceReportParams,
} from "../types/report";

export async function getAttendanceReport(params: AttendanceReportParams): Promise<AttendanceReport> {
  const { data } = await apiClient.get<AttendanceReport>("/reports/attendance", { params });
  return data;
}

export async function getPayrollReport(params: PayrollReportParams): Promise<PayrollReport> {
  const { data } = await apiClient.get<PayrollReport>("/reports/payroll", { params });
  return data;
}

export async function getPaymentsReport(params: PaymentsReportParams): Promise<PaymentsReport> {
  const { data } = await apiClient.get<PaymentsReport>("/reports/payments", { params });
  return data;
}

export async function getWorkforceReport(params: WorkforceReportParams): Promise<WorkforceReport> {
  // The backend's activeOnly is a "true"/"false" string, not a real
  // boolean (HTTP query params are always strings on the wire) — omit the
  // key entirely to get the backend's own default rather than sending a
  // string "undefined".
  const { data } = await apiClient.get<WorkforceReport>("/reports/workforce", {
    params: {
      storeId: params.storeId,
      ...(params.activeOnly === undefined ? {} : { activeOnly: params.activeOnly ? "true" : "false" }),
    },
  });
  return data;
}
