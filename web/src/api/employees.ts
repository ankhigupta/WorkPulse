import { apiClient } from "./client";
import type { Employee } from "../types/domain";

// email/password are optional and must be supplied together — omitting
// both creates an account-less workforce record, which stays fully
// supported (attendance, payroll and payments all work without a login).
export interface CreateEmployeeInput {
  name: string;
  storeId: string;
  dailyWage: number;
  joinedAt: string;
  email?: string;
  password?: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  storeId?: string;
  dailyWage?: number;
  joinedAt?: string;
  isActive?: boolean;
}

export async function listEmployees(): Promise<Employee[]> {
  const { data } = await apiClient.get<Employee[]>("/employees");
  return data;
}

export async function getEmployee(employeeId: string): Promise<Employee> {
  const { data } = await apiClient.get<Employee>(`/employees/${employeeId}`);
  return data;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const { data } = await apiClient.post<Employee>("/employees", input);
  return data;
}

export async function updateEmployee(employeeId: string, input: UpdateEmployeeInput): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`/employees/${employeeId}`, input);
  return data;
}
