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
