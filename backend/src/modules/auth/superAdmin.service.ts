import bcrypt from "bcrypt";
import { prisma } from "../../common/db/prisma";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";

export interface BootstrapSuperAdminResult {
  created: boolean;
  userId: string;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// The only way a SUPER_ADMIN account is ever created — never a public
// endpoint, never the normal login/signup UI. Intended to be run via
// scripts/bootstrapSuperAdmin.ts, not called from any route.
//
// Idempotent: re-running against an email that's already SUPER_ADMIN is a
// no-op, not a duplicate row or an error — safe to run on every local
// setup. Refuses to touch an existing account of any *other* role, since
// silently promoting one would be a privilege-escalation path, not a
// bootstrap convenience.
export async function bootstrapSuperAdmin(email: string, password: string): Promise<BootstrapSuperAdminResult> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });

  if (existing) {
    if (existing.role !== Role.SUPER_ADMIN) {
      throw new Error(
        `An account with email "${email}" already exists with role ${existing.role}, not SUPER_ADMIN. Refusing to change an existing account's role.`,
      );
    }
    return { created: false, userId: existing.id };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, role: Role.SUPER_ADMIN, organizationId: null },
      select: { id: true },
    });
    return { created: true, userId: user.id };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // Two bootstrap runs raced between the check above and this insert —
      // the loser treats that the same as "already exists," not a failure.
      const raced = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } });
      if (raced.role !== Role.SUPER_ADMIN) {
        throw new Error(
          `An account with email "${email}" already exists with role ${raced.role}, not SUPER_ADMIN.`,
        );
      }
      return { created: false, userId: raced.id };
    }
    throw error;
  }
}
