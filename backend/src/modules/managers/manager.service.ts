import bcrypt from "bcrypt";
import { prisma } from "../../common/db/prisma";
import { ConflictError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";

const managerSelect = {
  id: true,
  organizationId: true,
  storeId: true,
  joinedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, role: true, isActive: true } },
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

interface CreateManagerInput {
  email: string;
  password: string;
  storeId: string;
  joinedAt: Date;
}

export async function createManager(organizationId: string, data: CreateManagerInput) {
  await assertStoreBelongsToOrganization(data.storeId, organizationId);

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, passwordHash, role: Role.STORE_MANAGER, organizationId },
      });

      return tx.manager.create({
        data: {
          userId: user.id,
          organizationId,
          storeId: data.storeId,
          joinedAt: data.joinedAt,
        },
        select: managerSelect,
      });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }
}

export async function listManagersForOrganization(organizationId: string) {
  return prisma.manager.findMany({
    where: { organizationId },
    select: managerSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getManagerForOrganization(organizationId: string, managerId: string) {
  const manager = await prisma.manager.findFirst({
    where: { id: managerId, organizationId },
    select: managerSelect,
  });

  if (!manager) {
    throw new NotFoundError("Manager not found");
  }

  return manager;
}

interface UpdateManagerInput {
  storeId?: string;
  joinedAt?: Date;
  isActive?: boolean;
}

export async function updateManagerForOrganization(
  organizationId: string,
  managerId: string,
  data: UpdateManagerInput,
) {
  const existing = await prisma.manager.findFirst({ where: { id: managerId, organizationId } });
  if (!existing) {
    throw new NotFoundError("Manager not found");
  }

  if (data.storeId) {
    await assertStoreBelongsToOrganization(data.storeId, organizationId);
  }

  return prisma.manager.update({ where: { id: managerId }, data, select: managerSelect });
}
