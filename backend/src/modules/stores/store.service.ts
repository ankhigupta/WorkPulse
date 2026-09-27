import { prisma } from "../../common/db/prisma";
import { ConflictError, NotFoundError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";

interface StoreInput {
  name?: string;
  address?: string;
  isActive?: boolean;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createStore(organizationId: string, data: { name: string; address?: string }) {
  try {
    return await prisma.store.create({ data: { ...data, organizationId } });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("A store with this name already exists in your organization");
    }
    throw error;
  }
}

export async function listStoresForOrganization(organizationId: string) {
  return prisma.store.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
}

// Scoped by organizationId directly in the query, not checked after the
// fact — a store belonging to another organization simply doesn't match
// the WHERE clause and comes back as "not found", never as "forbidden".
export async function getStoreForOrganization(organizationId: string, storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, organizationId } });

  if (!store) {
    throw new NotFoundError("Store not found");
  }

  return store;
}

export async function updateStoreForOrganization(
  organizationId: string,
  storeId: string,
  data: StoreInput,
) {
  const existing = await prisma.store.findFirst({ where: { id: storeId, organizationId } });
  if (!existing) {
    throw new NotFoundError("Store not found");
  }

  try {
    return await prisma.store.update({ where: { id: storeId }, data });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("A store with this name already exists in your organization");
    }
    throw error;
  }
}
