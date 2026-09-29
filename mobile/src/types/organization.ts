// Mirrors backend/src/modules/organizations/organization.service.ts's
// return shape — a full, unselected Prisma row (no select clause), and
// the Prisma model itself has no fields beyond these.
export interface Organization {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ORGANIZATION_ADMIN only ever gets updateOrganizationAsOrgAdminSchema on
// the backend (picked per-request by role) — `name` only. `isActive` is a
// SUPER_ADMIN-only concern (platform-level suspend/reactivate), never
// sent from this app, which has no SUPER_ADMIN console at all.
export interface UpdateOrganizationInput {
  name?: string;
}

// GET /organizations/lookup?code=... — deliberately just {id, name}, an
// explicit select on the backend, never the full Organization row.
export interface OrganizationLookupResult {
  id: string;
  name: string;
}
