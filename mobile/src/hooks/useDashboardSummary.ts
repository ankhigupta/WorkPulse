import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "../api/dashboard";

export const dashboardSummaryQueryKey = ["dashboard", "summary"] as const;

// No date params are passed — the backend's own current-calendar-month
// default is what this screen shows for now (a date picker is a separate,
// deliberately deferred decision; see the milestone notes).
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryQueryKey,
    queryFn: () => getDashboardSummary(),
    // Headcounts/payroll totals don't change second-to-second; this just
    // avoids a redundant refetch if the user bounces between tabs quickly.
    // Pull-to-refresh (refetch()) always bypasses this.
    staleTime: 60_000,
  });
}
