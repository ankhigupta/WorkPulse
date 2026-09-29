import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../../common/db/prisma";
import { logger } from "../../common/logger";
import { ConflictError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { AccessRequestStatus, Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";
import { getOrganizationByJoinCode } from "../organizations/organization.service";

const STATUS_TOKEN_BYTES = 32;

// Never returns passwordHash or statusTokenHash — every select in this
// file is explicit about that, not "select everything then strip it."
const accessRequestSelect = {
  id: true,
  organizationId: true,
  email: true,
  requestedRole: true,
  requestedName: true,
  status: true,
  reviewedByUserId: true,
  reviewedAt: true,
  rejectionReason: true,
  createdUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function assertStoreBelongsToOrganization(storeId: string, organizationId: string): Promise<void> {
  const store = await prisma.store.findFirst({ where: { id: storeId, organizationId } });
  if (!store) {
    throw new NotFoundError("Store not found");
  }
}

// Same reasoning as auth.service.ts's hashRefreshToken: the raw
// statusToken needs exact-match lookup by value on every status check,
// which bcrypt (salted per call) can't support — SHA-256 instead, never
// the raw token stored anywhere.
function hashStatusToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

interface CreateAccessRequestInput {
  organizationCode: string;
  email: string;
  password: string;
  name: string;
  requestedRole: "EMPLOYEE" | "STORE_MANAGER";
}

interface CreateAccessRequestResult {
  requestId: string;
  statusToken: string;
}

// No User is created here at all — only staging state. See ADR for the
// full reasoning; in short, every existing service's `auth.organizationId!`
// non-null assertion rests on "every non-SUPER_ADMIN role always has an
// org," which a pending/unapproved User would violate everywhere.
export async function createAccessRequest(data: CreateAccessRequestInput): Promise<CreateAccessRequestResult> {
  // Reuses the exact same public lookup a join-code confirmation UI would
  // call — an invalid or inactive code produces the identical generic
  // 404 here as it would there. This function never learns, and can
  // never leak, whether a code was "wrong" versus "disabled."
  const organization = await getOrganizationByJoinCode(data.organizationCode);

  const passwordHash = await bcrypt.hash(data.password, 12);
  const rawStatusToken = crypto.randomBytes(STATUS_TOKEN_BYTES).toString("hex");
  const statusTokenHash = hashStatusToken(rawStatusToken);

  try {
    const request = await prisma.accessRequest.create({
      data: {
        organizationId: organization.id,
        email: data.email,
        passwordHash,
        requestedRole: data.requestedRole,
        requestedName: data.name,
        statusTokenHash,
      },
      select: { id: true },
    });

    logger.info(
      { requestId: request.id, organizationId: organization.id, requestedRole: data.requestedRole },
      "Access request submitted",
    );

    // The raw token is returned exactly once, here, and never persisted
    // or logged anywhere — the requester must save it themselves to
    // check status later.
    return { requestId: request.id, statusToken: rawStatusToken };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // The partial unique index on (email, organizationId) WHERE
      // status = 'PENDING' — see the migration for why this can't be
      // expressed in schema.prisma directly.
      throw new ConflictError("A pending request already exists for this email and organization");
    }
    throw error;
  }
}

interface AccessRequestStatusResult {
  status: AccessRequestStatus;
  organizationName: string;
}

// Requires both requestId and the raw statusToken — a wrong id and a
// wrong token produce the identical NotFoundError, so this can't be used
// to enumerate valid request ids, and it's deliberately not searchable
// by email at all. Only status + which organization is returned — never
// email, requestedRole, requestedName, or (per the locked product
// decision) the rejection reason, which is admin-only context.
export async function getAccessRequestStatus(requestId: string, rawToken: string): Promise<AccessRequestStatusResult> {
  const statusTokenHash = hashStatusToken(rawToken);

  const request = await prisma.accessRequest.findFirst({
    where: { id: requestId, statusTokenHash },
    select: { status: true, organization: { select: { name: true } } },
  });

  if (!request) {
    throw new NotFoundError("Access request not found");
  }

  return { status: request.status, organizationName: request.organization.name };
}

export interface ListAccessRequestFilters {
  status?: AccessRequestStatus;
}

export async function listAccessRequestsForAuth(auth: AuthContext, filters: ListAccessRequestFilters) {
  const organizationId = auth.organizationId!;

  return prisma.accessRequest.findMany({
    where: { organizationId, ...(filters.status ? { status: filters.status } : {}) },
    select: accessRequestSelect,
    orderBy: { createdAt: "desc" },
  });
}

interface ApproveAsEmployee {
  role: "EMPLOYEE";
  storeId: string;
  joinedAt: Date;
  name?: string;
  dailyWage: number;
}

interface ApproveAsManager {
  role: "STORE_MANAGER";
  storeId: string;
  joinedAt: Date;
}

export type ApproveAccessRequestInput = ApproveAsEmployee | ApproveAsManager;

// A single atomic operation: claim the PENDING row (race-safe, same
// conditional-updateMany pattern AttendanceCorrection already uses),
// create the User + Employee/Manager, link the request to that User, all
// inside one transaction. If anything after the claim fails (most
// notably: the requester's email already belongs to a User — a real,
// reachable case when the same email has simultaneous PENDING requests
// at two different organizations, see the partial-unique-index comment
// on the schema), the whole transaction rolls back, including the claim
// itself — the request reverts to PENDING rather than getting stuck
// half-approved.
export async function approveAccessRequest(auth: AuthContext, requestId: string, data: ApproveAccessRequestInput) {
  const organizationId = auth.organizationId!;

  const existing = await prisma.accessRequest.findFirst({ where: { id: requestId, organizationId } });
  if (!existing) {
    throw new NotFoundError("Access request not found");
  }

  await assertStoreBelongsToOrganization(data.storeId, organizationId);

  try {
    return await prisma.$transaction(async (tx) => {
      const claim = await tx.accessRequest.updateMany({
        where: { id: requestId, organizationId, status: AccessRequestStatus.PENDING },
        data: {
          status: AccessRequestStatus.APPROVED,
          reviewedByUserId: auth.userId,
          reviewedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        throw new ConflictError("This access request has already been processed");
      }

      // The password hash captured at request time, copied verbatim —
      // never re-hashed, never re-entered.
      const user = await tx.user.create({
        data: {
          email: existing.email,
          passwordHash: existing.passwordHash,
          role: data.role,
          organizationId,
        },
      });

      if (data.role === Role.EMPLOYEE) {
        await tx.employee.create({
          data: {
            userId: user.id,
            organizationId,
            storeId: data.storeId,
            name: data.name?.trim() || existing.requestedName,
            dailyWage: data.dailyWage,
            joinedAt: data.joinedAt,
          },
        });
      } else {
        await tx.manager.create({
          data: {
            userId: user.id,
            organizationId,
            storeId: data.storeId,
            joinedAt: data.joinedAt,
          },
        });
      }

      await tx.accessRequest.update({ where: { id: requestId }, data: { createdUserId: user.id } });

      logger.info({ requestId, createdUserId: user.id, role: data.role }, "Access request approved");

      return tx.accessRequest.findUniqueOrThrow({ where: { id: requestId }, select: accessRequestSelect });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }
}

// A single conditional UPDATE is already atomic on its own — rejection
// never creates anything, so there's nothing else to coordinate inside
// an explicit transaction, same as AttendanceCorrection's reject path.
export async function rejectAccessRequest(auth: AuthContext, requestId: string, reason?: string) {
  const organizationId = auth.organizationId!;

  const existing = await prisma.accessRequest.findFirst({ where: { id: requestId, organizationId } });
  if (!existing) {
    throw new NotFoundError("Access request not found");
  }

  const result = await prisma.accessRequest.updateMany({
    where: { id: requestId, organizationId, status: AccessRequestStatus.PENDING },
    data: {
      status: AccessRequestStatus.REJECTED,
      reviewedByUserId: auth.userId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });

  if (result.count === 0) {
    throw new ConflictError("This access request has already been processed");
  }

  logger.info({ requestId }, "Access request rejected");

  return prisma.accessRequest.findUniqueOrThrow({ where: { id: requestId }, select: accessRequestSelect });
}
