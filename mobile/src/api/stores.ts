import { apiClient } from "./client";
import type { Store } from "../types/store";

// GET /api/stores is ORGANIZATION_ADMIN-only on the backend (see
// backend/src/modules/stores/store.routes.ts) — only called from
// screens already gated to that role (employee create/edit).
export async function listStores(): Promise<Store[]> {
  const { data } = await apiClient.get<Store[]>("/stores");
  return data;
}
