import { apiClient } from "./client";
import type { CreateEmployeeInput, Employee, UpdateEmployeeInput } from "../types/employee";

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
