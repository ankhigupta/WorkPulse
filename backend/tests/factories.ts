import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../src/common/db/prisma";
import { Role } from "../src/generated/prisma/enums";

export async function createTestOrganization(name = "Test Org") {
  return prisma.organization.create({ data: { name } });
}

interface CreateTestUserOptions {
  email?: string;
  password?: string;
  role?: Role;
  organizationId?: string | null;
  isActive?: boolean;
}

export async function createTestUser(options: CreateTestUserOptions = {}) {
  const password = options.password ?? "Test1234!";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: options.email ?? `user-${crypto.randomUUID()}@example.com`,
      passwordHash,
      role: options.role ?? Role.ORGANIZATION_ADMIN,
      organizationId: options.organizationId ?? null,
      isActive: options.isActive ?? true,
    },
  });

  return { user, password };
}

export async function createTestStore(organizationId: string, name = `Store ${crypto.randomUUID()}`) {
  return prisma.store.create({ data: { organizationId, name } });
}

interface CreateTestManagerOptions {
  organizationId: string;
  storeId: string;
  email?: string;
  password?: string;
  isActive?: boolean;
}

// Creates the User + Manager pair directly, bypassing the Manager-creation
// API — used to set up the "acting as a store manager" side of a test
// without depending on the very endpoint another test is verifying.
export async function createTestManager(options: CreateTestManagerOptions) {
  const password = options.password ?? "Test1234!";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: options.email ?? `manager-${crypto.randomUUID()}@example.com`,
      passwordHash,
      role: Role.STORE_MANAGER,
      organizationId: options.organizationId,
      isActive: options.isActive ?? true,
    },
  });

  const manager = await prisma.manager.create({
    data: {
      userId: user.id,
      organizationId: options.organizationId,
      storeId: options.storeId,
      joinedAt: new Date(),
    },
  });

  return { user, manager, password };
}
