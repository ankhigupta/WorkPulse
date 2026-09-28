import { prisma } from "../../common/db/prisma";
import { NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";
import { getEmployeeForAuth, resolveManagerStoreId } from "../employees/employee.service";

const noteSelect = {
  id: true,
  employeeId: true,
  authorUserId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface CreateEmployeeNoteInput {
  employeeId: string;
  body: string;
}

export async function createEmployeeNote(auth: AuthContext, data: CreateEmployeeNoteInput) {
  // Reuses the Employees module's own org/store-scoped accessibility check
  // — an employee outside the caller's organization (or, for
  // STORE_MANAGER, outside their assigned store) is simply "not found".
  const employee = await getEmployeeForAuth(auth, data.employeeId);

  return prisma.employeeNote.create({
    data: {
      employeeId: employee.id,
      authorUserId: auth.userId,
      body: data.body,
    },
    select: noteSelect,
  });
}

export interface ListEmployeeNoteFilters {
  employeeId?: string;
}

// EmployeeNote has no organizationId of its own — tenant/store ownership
// is derived entirely through the Employee it belongs to, expressed as a
// relational filter rather than duplicating that data onto this table.
// Same technique already used for AttendanceCorrection's store scoping.
async function buildScopedWhere(
  auth: AuthContext,
  filters: ListEmployeeNoteFilters,
): Promise<Prisma.EmployeeNoteWhereInput> {
  const employeeFilter: Prisma.EmployeeWhereInput = {
    organizationId: auth.organizationId!,
  };

  if (auth.role === Role.STORE_MANAGER) {
    employeeFilter.storeId = await resolveManagerStoreId(auth.userId);
  }

  const where: Prisma.EmployeeNoteWhereInput = { employee: { is: employeeFilter } };

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  return where;
}

export async function listEmployeeNotesForAuth(auth: AuthContext, filters: ListEmployeeNoteFilters) {
  const where = await buildScopedWhere(auth, filters);
  return prisma.employeeNote.findMany({
    where,
    select: noteSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getEmployeeNoteForAuth(auth: AuthContext, noteId: string) {
  const where = await buildScopedWhere(auth, {});
  const note = await prisma.employeeNote.findFirst({
    where: { ...where, id: noteId },
    select: noteSelect,
  });

  if (!note) {
    throw new NotFoundError("Employee note not found");
  }

  return note;
}
