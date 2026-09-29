import { useQuery } from "@tanstack/react-query";
import * as reportsApi from "../api/reports";
import type { AttendanceReportParams, PaymentsReportParams, PayrollReportParams, WorkforceReportParams } from "../types/report";

// Each report is its own query key, parameterized by its actual filter
// state — changing a filter is a genuinely different cache entry, and
// `enabled` gates every one so a report only ever fetches once its
// screen is actually open and (for the three date-based reports) a valid
// range has been applied. No report fetches speculatively or in the
// background for a screen the user hasn't opened.

export function useAttendanceReport(params: AttendanceReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "attendance", params],
    queryFn: () => reportsApi.getAttendanceReport(params),
    enabled,
    staleTime: 15_000,
  });
}

export function usePayrollReport(params: PayrollReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "payroll", params],
    queryFn: () => reportsApi.getPayrollReport(params),
    enabled,
    staleTime: 15_000,
  });
}

export function usePaymentsReport(params: PaymentsReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "payments", params],
    queryFn: () => reportsApi.getPaymentsReport(params),
    enabled,
    staleTime: 15_000,
  });
}

export function useWorkforceReport(params: WorkforceReportParams) {
  // No required date range — this report is always safe to fetch as soon
  // as its screen mounts, same as any other list screen in this app.
  return useQuery({
    queryKey: ["reports", "workforce", params],
    queryFn: () => reportsApi.getWorkforceReport(params),
    staleTime: 15_000,
  });
}
