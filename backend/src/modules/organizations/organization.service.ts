import { prisma } from "../../common/db/prisma";
import { NotFoundError } from "../../common/errors";
import { Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";

export async function createOrganization(name: string) {
  return prisma.organization.create({ data: { name } });
}

export async function listOrganizations() {
  return prisma.organization.findMany({ orderBy: { createdAt: "asc" } });
}

// SUPER_ADMIN can look up any organization. ORGANIZATION_ADMIN can only
// look up their own — anything else returns 404, not 403, so a mismatched
// id doesn't confirm whether that organization even exists (IDOR hygiene).
export async function getOrganizationForAuth(auth: AuthContext, organizationId: string) {
  if (auth.role === Role.ORGANIZATION_ADMIN && auth.organizationId !== organizationId) {
    throw new NotFoundError("Organization not found");
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });

  if (!organization) {
    throw new NotFoundError("Organization not found");
  }

  return organization;
}

export async function updateOrganizationForAuth(
  auth: AuthContext,
  organizationId: string,
  data: { name?: string; isActive?: boolean },
) {
  if (auth.role === Role.ORGANIZATION_ADMIN && auth.organizationId !== organizationId) {
    throw new NotFoundError("Organization not found");
  }

  const existing = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!existing) {
    throw new NotFoundError("Organization not found");
  }

  return prisma.organization.update({ where: { id: organizationId }, data });
}
