import { apiClient } from "./client";
import type { Organization } from "../types/domain";

export async function getOrganization(organizationId: string): Promise<Organization> {
  const { data } = await apiClient.get<Organization>(`/organizations/${organizationId}`);
  return data;
}

/** ORGANIZATION_ADMIN may only send `name`; `isActive` is SUPER_ADMIN-only. */
export async function updateOrganization(
  organizationId: string,
  input: { name?: string; isActive?: boolean },
): Promise<Organization> {
  const { data } = await apiClient.patch<Organization>(`/organizations/${organizationId}`, input);
  return data;
}

// SUPER_ADMIN only.
export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await apiClient.get<Organization[]>("/organizations");
  return data;
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data } = await apiClient.post<Organization>("/organizations", { name });
  return data;
}
