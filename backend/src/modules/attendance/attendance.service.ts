import { prisma } from "../../common/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors";
import { getEmployeeForAuth, resolveManagerStoreId } from "../employees/employee.service";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";

const attendanceSelect = {
  id: true,
  employeeId: true,
  storeId: true,
  organizationId: true,
  date: true,
  status: true,
  method: true,
  checkInAt: true,
  markedByUserId: true,
  statusChangedByUserId: true,
  statusChangedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

interface CreateAttendanceInput {
  employeeId: string;
  date: Date;
  status: "PRESENT" | "ABSENT";
  method: "QR" | "MANUAL";
  checkInAt?: Date;
}

export async function createAttendance(auth: AuthContext, data: CreateAttendanceInput) {
  // Reuses the Employees module's own org/store-scoped accessibility check
  // — an employee outside the caller's organization (or, for
  // STORE_MANAGER, outside their assigned store) is simply "not found",
  // exactly as it already behaves for GET /api/employees/:employeeId.
  const employee = await getEmployeeForAuth(auth, data.employeeId);

  try {
    return await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        // storeId is derived from the employee's current store — never
        // client-supplied. This is also what makes a STORE_MANAGER's
        // client-supplied storeId a non-issue for creation: there simply
        // is no such input field to escape through.
        storeId: employee.storeId,
        organizationId: employee.organizationId,
        date: data.date,
        status: data.status,
        method: data.method,
        checkInAt: data.checkInAt ?? null,
        markedByUserId: auth.userId,
      },
      select: attendanceSelect,
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("Attendance already recorded for this employee on this date");
    }
    throw error;
  }
}

export interface ListAttendanceFilters {
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  employeeId?: string;
  storeId?: string;
  status?: "PRESENT" | "ABSENT";
}

// Ownership is enforced directly in this WHERE clause, not by fetching a
// row and checking it in application code afterward — every caller of
// this function (list/get/update) builds their query from it.
async function buildScopedWhere(
  auth: AuthContext,
  filters: ListAttendanceFilters,
): Promise<Prisma.AttendanceWhereInput> {
  const where: Prisma.AttendanceWhereInput = {
    organizationId: auth.organizationId!,
  };

  if (auth.role === Role.STORE_MANAGER) {
    // A client-supplied storeId filter is ignored outright for
    // STORE_MANAGER — their own assigned store always wins, it can never
    // be widened or redirected by request input.
    where.storeId = await resolveManagerStoreId(auth.userId);
  } else if (filters.storeId) {
    where.storeId = filters.storeId;
  }

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.date) {
    where.date = filters.date;
  } else if (filters.startDate || filters.endDate) {
    where.date = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  return where;
}

export async function listAttendanceForAuth(auth: AuthContext, filters: ListAttendanceFilters) {
  const where = await buildScopedWhere(auth, filters);
  return prisma.attendance.findMany({
    where,
    select: attendanceSelect,
    orderBy: { date: "desc" },
  });
}

export async function getAttendanceForAuth(auth: AuthContext, attendanceId: string) {
  const where = await buildScopedWhere(auth, {});
  const attendance = await prisma.attendance.findFirst({
    where: { ...where, id: attendanceId },
    select: attendanceSelect,
  });

  if (!attendance) {
    throw new NotFoundError("Attendance not found");
  }

  return attendance;
}

interface UpdateAttendanceInput {
  method?: "QR" | "MANUAL";
  status?: "PRESENT" | "ABSENT";
}

// The only two ways Attendance.status can ever change after creation: this
// function (a direct ORGANIZATION_ADMIN edit) and
// attendanceCorrection.service.ts's approveCorrection (an approved
// correction). Both are a plain `update` against the one existing row —
// neither this function nor that one ever calls `create`, so there is no
// code path left that could produce a second Attendance row for the same
// employee/date; the database's (employeeId, date) unique index is the
// backstop if one ever did.
export async function updateAttendanceForAuth(
  auth: AuthContext,
  attendanceId: string,
  data: UpdateAttendanceInput,
) {
  // Route-level schema selection (attendance.routes.ts) already keeps a
  // STORE_MANAGER from ever sending `status` — this is the service-layer
  // backstop so that guarantee doesn't rest on routing alone, matching
  // this codebase's "never rely only on frontend/route gating" discipline.
  if (data.status !== undefined && auth.role !== Role.ORGANIZATION_ADMIN) {
    throw new ForbiddenError("Only an organization admin can change attendance status directly");
  }

  const where = await buildScopedWhere(auth, {});
  const existing = await prisma.attendance.findFirst({ where: { ...where, id: attendanceId } });

  if (!existing) {
    throw new NotFoundError("Attendance not found");
  }

  const updateData: Prisma.AttendanceUpdateInput = { method: data.method };
  if (data.status !== undefined) {
    updateData.status = data.status;
    // Audit trail for the direct-edit path — who changed the status and
    // when, independent of markedByUserId (who originally recorded it).
    updateData.statusChangedBy = { connect: { id: auth.userId } };
    updateData.statusChangedAt = new Date();
  }

  return prisma.attendance.update({ where: { id: attendanceId }, data: updateData, select: attendanceSelect });
}
