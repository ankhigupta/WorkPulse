import { apiClient } from "./client";
import type { EmployeeBalance, Payment, Payroll, PayrollStatus } from "../types/domain";

export interface ListPayrollFilters {
  employeeId?: string;
  storeId?: string;
  status?: PayrollStatus;
  periodStart?: string;
  periodEnd?: string;
}

export async function listPayroll(filters: ListPayrollFilters = {}): Promise<Payroll[]> {
  const { data } = await apiClient.get<Payroll[]>("/payroll", { params: filters });
  return data;
}

// Wage totals are computed server-side from attendance — the client never
// recalculates them, it only displays what the API returns.
export async function createPayroll(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<Payroll> {
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

export interface ListPaymentFilters {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}

export async function listPayments(filters: ListPaymentFilters = {}): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>("/payments", { params: filters });
  return data;
}

export async function createPayment(input: {
  employeeId: string;
  amount: number;
  paidAt: string;
  note?: string;
}): Promise<Payment> {
  const { data } = await apiClient.post<Payment>("/payments", input);
  return data;
}

export async function getEmployeeBalance(employeeId: string): Promise<EmployeeBalance> {
  const { data } = await apiClient.get<EmployeeBalance>(`/payments/balance/${employeeId}`);
  return data;
}
