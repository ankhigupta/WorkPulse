import { apiClient } from "./client";
import type { Store } from "../types/domain";

export interface CreateStoreInput {
  name: string;
  address?: string;
}

export interface UpdateStoreInput {
  name?: string;
  address?: string;
  isActive?: boolean;
}

export async function listStores(): Promise<Store[]> {
  const { data } = await apiClient.get<Store[]>("/stores");
  return data;
}

export async function getStore(storeId: string): Promise<Store> {
  const { data } = await apiClient.get<Store>(`/stores/${storeId}`);
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
