import { apiClient } from "./client";
import type { DashboardSummary, DashboardSummaryParams } from "../types/dashboard";

export async function getDashboardSummary(params?: DashboardSummaryParams): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary", { params });
  return data;
}
