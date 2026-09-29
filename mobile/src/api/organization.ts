import { apiClient } from "./client";
import type { Organization, UpdateOrganizationInput } from "../types/organization";

// GET/PATCH /:organizationId are SUPER_ADMIN or ORGANIZATION_ADMIN on the
// backend, and an ORGANIZATION_ADMIN may only ever look up their own
// (anything else 404s, not 403 — see organization.service.ts). This app
// only ever calls these with the caller's own organizationId. No
// create/list — both are SUPER_ADMIN-only and out of this app's scope.
export async function getOrganization(organizationId: string): Promise<Organization> {
  const { data } = await apiClient.get<Organization>(`/organizations/${organizationId}`);
  return data;
}

export async function updateOrganization(organizationId: string, input: UpdateOrganizationInput): Promise<Organization> {
  const { data } = await apiClient.patch<Organization>(`/organizations/${organizationId}`, input);
  return data;
}
