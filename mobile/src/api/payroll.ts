import { apiClient } from "./client";
import type { CreatePayrollInput, ListPayrollParams, Payroll } from "../types/payroll";

export async function listPayroll(params: ListPayrollParams): Promise<Payroll[]> {
  const { data } = await apiClient.get<Payroll[]>("/payroll", { params });
  return data;
}

export async function createPayroll(input: CreatePayrollInput): Promise<Payroll> {
  const { data } = await apiClient.post<Payroll>("/payroll", input);
  return data;
}

export async function recalculatePayroll(payrollId: string): Promise<Payroll> {
  const { data } = await apiClient.post<Payroll>(`/payroll/${payrollId}/recalculate`);
  return data;
}

export async function finalizePayroll(payrollId: string): Promise<Payroll> {
  const { data } = await apiClient.post<Payroll>(`/payroll/${payrollId}/finalize`);
  return data;
}
