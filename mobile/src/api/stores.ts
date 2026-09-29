import { apiClient } from "./client";
import type { CreateStoreInput, Store, UpdateStoreInput } from "../types/store";

// The whole /api/stores router is ORGANIZATION_ADMIN-only (see
// backend/src/modules/stores/store.routes.ts) — every function here is
// only ever called from screens already gated to that role (employee/
// manager/payroll create forms, and the More > Stores management screens).
export async function listStores(): Promise<Store[]> {
  const { data } = await apiClient.get<Store[]>("/stores");
  return data;
}

export async function createStore(input: CreateStoreInput): Promise<Store> {
  const { data } = await apiClient.post<Store>("/stores", input);
  return data;
}

export async function updateStore(storeId: string, input: UpdateStoreInput): Promise<Store> {
  const { data } = await apiClient.patch<Store>(`/stores/${storeId}`, input);
  return data;
}
