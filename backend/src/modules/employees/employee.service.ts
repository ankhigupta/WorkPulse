import bcrypt from "bcrypt";
import { prisma } from "../../common/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import type { AuthContext } from "../../types/express";

const employeeSelect = {
  id: true,
  organizationId: true,
  storeId: true,
  dailyWage: true,
  qrCodeToken: true,
  joinedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, role: true, isActive: true } },
} as const;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// A store belonging to another organization simply doesn't match this
// query and comes back "not found" — never "forbidden". This is also how
// "assign to another org's store" attempts get rejected: there is no
// separate check, the store just isn't visible outside its own org.
async function assertStoreBelongsToOrganization(storeId: string, organizationId: string): Promise<void> {
  const store = await prisma.store.findFirst({ where: { id: storeId, organizationId } });
  if (!store) {
    throw new NotFoundError("Store not found");
  }
}

// STORE_MANAGER's store assignment isn't a JWT claim (only organizationId
// and role are) — it's looked up fresh from the Manager row on every
// request, same staleness trade-off already made for User.isActive in /me.
export async function resolveManagerStoreId(userId: string): Promise<string> {
  const manager = await prisma.manager.findUnique({ where: { userId } });
  if (!manager) {
    throw new ForbiddenError("No store assignment found for this manager account");
  }
  return manager.storeId;
}

interface CreateEmployeeInput {
  email: string;
  password: string;
  storeId: string;
  dailyWage: number;
  joinedAt: Date;
}

export async function createEmployee(organizationId: string, data: CreateEmployeeInput) {
  await assertStoreBelongsToOrganization(data.storeId, organizationId);

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, passwordHash, role: Role.EMPLOYEE, organizationId },
      });

      return tx.employee.create({
        data: {
          userId: user.id,
          organizationId,
          storeId: data.storeId,
          dailyWage: data.dailyWage,
          joinedAt: data.joinedAt,
        },
        select: employeeSelect,
      });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }
}

export async function listEmployeesForAuth(auth: AuthContext) {
  if (auth.role === Role.STORE_MANAGER) {
    const storeId = await resolveManagerStoreId(auth.userId);
    return prisma.employee.findMany({
      where: { storeId },
      select: employeeSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  return prisma.employee.findMany({
    where: { organizationId: auth.organizationId! },
    select: employeeSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getEmployeeForAuth(auth: AuthContext, employeeId: string) {
  const where =
    auth.role === Role.STORE_MANAGER
      ? { id: employeeId, storeId: await resolveManagerStoreId(auth.userId) }
      : { id: employeeId, organizationId: auth.organizationId! };

  const employee = await prisma.employee.findFirst({ where, select: employeeSelect });

  if (!employee) {
    throw new NotFoundError("Employee not found");
  }

  return employee;
}

interface UpdateEmployeeInput {
  storeId?: string;
  dailyWage?: number;
  joinedAt?: Date;
  isActive?: boolean;
}

// Route-gated to ORGANIZATION_ADMIN only — STORE_MANAGER never reaches
// this function.
export async function updateEmployeeForAuth(
  organizationId: string,
  employeeId: string,
  data: UpdateEmployeeInput,
) {
  const existing = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!existing) {
    throw new NotFoundError("Employee not found");
  }

  if (data.storeId) {
    await assertStoreBelongsToOrganization(data.storeId, organizationId);
  }

  return prisma.employee.update({ where: { id: employeeId }, data, select: employeeSelect });
}
