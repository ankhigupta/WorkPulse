import { z } from "zod";

export const createOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
  })
  .strict();

// SUPER_ADMIN may also suspend/reactivate an organization.
export const updateOrganizationAsSuperAdminSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ORGANIZATION_ADMIN may only rename their own organization — isActive is a
// platform-level (SUPER_ADMIN) concern, deliberately not exposed here.
export const updateOrganizationAsOrgAdminSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
