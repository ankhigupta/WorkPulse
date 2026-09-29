import { apiClient } from "./client";
import type { CreatePaymentInput, EmployeeBalance, ListPaymentsParams, Payment } from "../types/payment";

export async function listPayments(params: ListPaymentsParams): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>("/payments", { params });
  return data;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const { data } = await apiClient.post<Payment>("/payments", input);
  return data;
}

export async function getEmployeeBalance(employeeId: string): Promise<EmployeeBalance> {
  const { data } = await apiClient.get<EmployeeBalance>(`/payments/balance/${employeeId}`);
  return data;
}
