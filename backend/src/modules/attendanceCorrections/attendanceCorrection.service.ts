import { prisma } from "../../common/db/prisma";
import { ConflictError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { CorrectionStatus, Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";
import { getAttendanceForAuth } from "../attendance/attendance.service";
import { resolveManagerStoreId } from "../employees/employee.service";

const correctionSelect = {
  id: true,
  attendanceId: true,
  organizationId: true,
  requestedByUserId: true,
  reviewedByUserId: true,
  proposedStatus: true,
  reason: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface CreateCorrectionInput {
  attendanceId: string;
  proposedStatus: "PRESENT" | "ABSENT";
  reason: string;
}

export async function createCorrection(auth: AuthContext, data: CreateCorrectionInput) {
  // Reuses the Attendance module's own org/store-scoped accessibility
  // check — an attendance record outside the caller's organization (or,
  // for STORE_MANAGER, outside their assigned store) is simply "not
  // found", exactly as GET /api/attendance/:attendanceId already behaves.
  const attendance = await getAttendanceForAuth(auth, data.attendanceId);

  return prisma.attendanceCorrection.create({
    data: {
      attendanceId: attendance.id,
      organizationId: attendance.organizationId,
      requestedByUserId: auth.userId,
      proposedStatus: data.proposedStatus,
      reason: data.reason,
      // status defaults to PENDING at the schema level — never accepted
      // from the client, and this creation path never touches
      // Attendance.status itself.
    },
    select: correctionSelect,
  });
}

export interface ListCorrectionFilters {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  employeeId?: string;
  attendanceId?: string;
  storeId?: string;
  startDate?: Date;
  endDate?: Date;
}

// AttendanceCorrection has no storeId/employeeId/date columns of its own —
// those live on the Attendance row it references. Rather than duplicate
// that data onto this table (a schema change nothing here actually
// requires), store/employee/date scoping is expressed as a relational
// filter through the existing `attendance` relation. Ownership is still
// enforced directly in the Prisma WHERE clause, just one join away.
async function buildScopedWhere(
  auth: AuthContext,
  filters: ListCorrectionFilters,
): Promise<Prisma.AttendanceCorrectionWhereInput> {
  const where: Prisma.AttendanceCorrectionWhereInput = {
    organizationId: auth.organizationId!,
  };

  const attendanceFilter: Prisma.AttendanceWhereInput = {};

  if (auth.role === Role.STORE_MANAGER) {
    // A client-supplied storeId filter never widens this — the manager's
    // own resolved store is always what's applied, full stop.
    attendanceFilter.storeId = await resolveManagerStoreId(auth.userId);
  } else if (filters.storeId) {
    attendanceFilter.storeId = filters.storeId;
  }

  if (filters.employeeId) {
    attendanceFilter.employeeId = filters.employeeId;
  }

  if (filters.startDate || filters.endDate) {
    attendanceFilter.date = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  if (Object.keys(attendanceFilter).length > 0) {
    where.attendance = { is: attendanceFilter };
  }

  if (filters.attendanceId) {
    where.attendanceId = filters.attendanceId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export async function listCorrectionsForAuth(auth: AuthContext, filters: ListCorrectionFilters) {
  const where = await buildScopedWhere(auth, filters);
  return prisma.attendanceCorrection.findMany({
    where,
    select: correctionSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getCorrectionForAuth(auth: AuthContext, correctionId: string) {
  const where = await buildScopedWhere(auth, {});
  const correction = await prisma.attendanceCorrection.findFirst({
    where: { ...where, id: correctionId },
    select: correctionSelect,
  });

  if (!correction) {
    throw new NotFoundError("Attendance correction not found");
  }

  return correction;
}

// Only ORGANIZATION_ADMIN ever reaches approve/reject (route-gated), so
// scoping here is organization-only, never store-scoped.
async function getOrgCorrectionOrThrow(organizationId: string, correctionId: string) {
  const correction = await prisma.attendanceCorrection.findFirst({
    where: { id: correctionId, organizationId },
  });

  if (!correction) {
    throw new NotFoundError("Attendance correction not found");
  }

  return correction;
}

export async function approveCorrection(auth: AuthContext, correctionId: string) {
  const correction = await getOrgCorrectionOrThrow(auth.organizationId!, correctionId);

  return prisma.$transaction(async (tx) => {
    // The WHERE clause here — not a prior read — is what prevents two
    // concurrent approvals (or an approve racing a reject) from both
    // succeeding. Postgres locks the matching row on this UPDATE; whichever
    // transaction commits first "wins" PENDING, and the second one's
    // conditional re-evaluates against the now-already-processed row and
    // matches zero rows. No version column or app-level lock needed.
    const result = await tx.attendanceCorrection.updateMany({
      where: { id: correctionId, status: CorrectionStatus.PENDING },
      data: {
        status: CorrectionStatus.APPROVED,
        reviewedByUserId: auth.userId,
        reviewedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictError("This correction has already been processed");
    }

    await tx.attendance.update({
      where: { id: correction.attendanceId },
      data: { status: correction.proposedStatus },
    });

    return tx.attendanceCorrection.findUniqueOrThrow({
      where: { id: correctionId },
      select: correctionSelect,
    });
  });
}

export async function rejectCorrection(auth: AuthContext, correctionId: string) {
  await getOrgCorrectionOrThrow(auth.organizationId!, correctionId);

  // A single conditional UPDATE is already atomic on its own — rejection
  // never touches Attendance, so there's nothing else to coordinate inside
  // an explicit transaction.
  const result = await prisma.attendanceCorrection.updateMany({
    where: { id: correctionId, status: CorrectionStatus.PENDING },
    data: {
      status: CorrectionStatus.REJECTED,
      reviewedByUserId: auth.userId,
      reviewedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new ConflictError("This correction has already been processed");
  }

  return prisma.attendanceCorrection.findUniqueOrThrow({
    where: { id: correctionId },
    select: correctionSelect,
  });
}
