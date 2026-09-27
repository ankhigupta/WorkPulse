import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/common/db/prisma";

// Belt-and-suspenders guard: refuse to run if the environment doesn't look
// like the test environment, no matter how this file was invoked.
if (process.env.NODE_ENV !== "test" || !process.env.DATABASE_URL?.includes("workpulse_test")) {
  throw new Error(
    "Refusing to run tests: environment does not look like the test environment. " +
      "Expected NODE_ENV=test and DATABASE_URL pointing at workpulse_test.",
  );
}

// Deterministic clean slate before every test. Deletion order respects the
// RESTRICT foreign keys: RefreshToken/Employee/Manager -> Store/User -> Organization.
beforeEach(async () => {
  await prisma.refreshToken.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.manager.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});
