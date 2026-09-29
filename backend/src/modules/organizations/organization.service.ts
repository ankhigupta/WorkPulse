import crypto from "node:crypto";
import { prisma } from "../../common/db/prisma";
import { Prisma } from "../../generated/prisma/client";
import { NotFoundError } from "../../common/errors";
import { Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";

type Db = typeof prisma | Prisma.TransactionClient;

// Excludes 0/O/1/I/L on purpose — a join code is meant to be read aloud
// and typed by hand, and this alphabet has no pair of characters that
// look alike at a glance. 31 symbols x 10 chars ≈ 49.5 bits of entropy,
// far past what a rate-limited lookup endpoint needs to be safe against
// guessing.
const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const JOIN_CODE_LENGTH = 10;
const MAX_JOIN_CODE_ATTEMPTS = 5;

function randomJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[crypto.randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

// Never derived from the organization's id/name, never sequential —
// pure randomness from Node's CSPRNG (crypto.randomInt), checked against
// the real table for a collision before use. At this alphabet/length the
// collision odds are astronomically small; the retry loop exists purely
// as a defensive backstop, not because a collision is actually expected.
export async function generateUniqueJoinCode(db: Db = prisma): Promise<string> {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const code = randomJoinCode();
    const existing = await db.organization.findUnique({ where: { joinCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique organization join code");
}

export async function createOrganization(name: string) {
  return prisma.organization.create({ data: { name, joinCode: await generateUniqueJoinCode() } });
}

export async function listOrganizations() {
  return prisma.organization.findMany({ orderBy: { createdAt: "asc" } });
}

// SUPER_ADMIN can look up any organization. ORGANIZATION_ADMIN can only
// look up their own — anything else returns 404, not 403, so a mismatched
// id doesn't confirm whether that organization even exists (IDOR hygiene).
// The full row (including joinCode) is returned here deliberately — this
// is how an ORGANIZATION_ADMIN retrieves their own join code, via the
// organization settings endpoint they already use, not a separate route.
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

// Public lookup used by the access-request/signup flow — a requester
// exchanges a join code for just enough to confirm they have the right
// organization before submitting. Deliberately returns only {id, name}
// (an explicit select, not the full row) and treats "code doesn't exist"
// and "code exists but the organization is inactive" identically: the
// same generic NotFoundError either way, so this endpoint can never be
// used to probe which codes are real versus merely disabled.
export async function getOrganizationByJoinCode(joinCode: string) {
  const organization = await prisma.organization.findUnique({
    where: { joinCode },
    select: { id: true, name: true, isActive: true },
  });

  if (!organization || !organization.isActive) {
    throw new NotFoundError("Organization not found");
  }

  return { id: organization.id, name: organization.name };
}
