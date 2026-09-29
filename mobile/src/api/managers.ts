import { apiClient } from "./client";
import type { CreateManagerInput, Manager, UpdateManagerInput } from "../types/manager";

export async function listManagers(): Promise<Manager[]> {
  const { data } = await apiClient.get<Manager[]>("/managers");
  return data;
}

export async function getManager(managerId: string): Promise<Manager> {
  const { data } = await apiClient.get<Manager>(`/managers/${managerId}`);
  return data;
}

export async function createManager(input: CreateManagerInput): Promise<Manager> {
  const { data } = await apiClient.post<Manager>("/managers", input);
  return data;
}

export async function updateManager(managerId: string, input: UpdateManagerInput): Promise<Manager> {
  const { data } = await apiClient.patch<Manager>(`/managers/${managerId}`, input);
  return data;
}
