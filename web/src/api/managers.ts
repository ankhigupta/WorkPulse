import { apiClient } from "./client";
import type { Manager } from "../types/domain";

// Unlike Employee, a Manager always requires a login account — email and
// password are mandatory at creation and have no change endpoint after.
export interface CreateManagerInput {
  email: string;
  password: string;
  storeId: string;
  joinedAt: string;
}

export interface UpdateManagerInput {
  storeId?: string;
  joinedAt?: string;
  isActive?: boolean;
}

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
