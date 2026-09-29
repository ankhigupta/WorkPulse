import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../src/common/db/prisma";
import { AccessRequestStatus, Role } from "../src/generated/prisma/enums";

export async function createTestOrganization(name = "Test Org") {
  return prisma.organization.create({
    data: { name, joinCode: crypto.randomBytes(6).toString("hex").toUpperCase() },
  });
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

interface CreateTestEmployeeOptions {
  organizationId: string;
  storeId: string;
  name?: string;
  email?: string;
  dailyWage?: number;
  isActive?: boolean;
}

// Creates the User + Employee pair directly, bypassing the
// Employee-creation API — used when a test needs an employee to exist as
// a fixture, not as the thing under test. Always creates a linked User
// (matching every existing call site's assumption) — for an employee with
// no login account at all, use createTestEmployeeWithoutUser instead.
export async function createTestEmployee(options: CreateTestEmployeeOptions) {
  const passwordHash = await bcrypt.hash("Test1234!", 12);

  const user = await prisma.user.create({
    data: {
      email: options.email ?? `employee-${crypto.randomUUID()}@example.com`,
      passwordHash,
      role: Role.EMPLOYEE,
      organizationId: options.organizationId,
      isActive: options.isActive ?? true,
    },
  });

  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      organizationId: options.organizationId,
      storeId: options.storeId,
      name: options.name ?? "Test Employee",
      dailyWage: options.dailyWage ?? 500,
      joinedAt: new Date(),
    },
  });

  return { user, employee };
}

interface CreateTestEmployeeWithoutUserOptions {
  organizationId: string;
  storeId: string;
  name?: string;
  dailyWage?: number;
  isActive?: boolean;
}

// Creates a pure workforce-record Employee with no linked User at all —
// the case this milestone introduced: an employee with no phone/email who
// never logs in, whose attendance is always recorded by a STORE_MANAGER.
export async function createTestEmployeeWithoutUser(options: CreateTestEmployeeWithoutUserOptions) {
  const employee = await prisma.employee.create({
    data: {
      organizationId: options.organizationId,
      storeId: options.storeId,
      name: options.name ?? "Test Employee (No Account)",
      dailyWage: options.dailyWage ?? 500,
      joinedAt: new Date(),
      isActive: options.isActive ?? true,
    },
  });

  return { employee };
}

interface CreateTestAttendanceOptions {
  employeeId: string;
  storeId: string;
  organizationId: string;
  markedByUserId: string;
  date?: Date;
  status?: "PRESENT" | "ABSENT";
  method?: "QR" | "MANUAL";
}

// Creates an Attendance row directly, bypassing the Attendance-creation
// API — used when a test needs an existing attendance record as a fixture
// for the AttendanceCorrection workflow under test.
export async function createTestAttendance(options: CreateTestAttendanceOptions) {
  return prisma.attendance.create({
    data: {
      employeeId: options.employeeId,
      storeId: options.storeId,
      organizationId: options.organizationId,
      date: options.date ?? new Date("2026-01-15"),
      status: options.status ?? "PRESENT",
      method: options.method ?? "MANUAL",
      markedByUserId: options.markedByUserId,
    },
  });
}

interface CreateTestAccessRequestOptions {
  organizationId: string;
  email?: string;
  password?: string;
  requestedRole?: "EMPLOYEE" | "STORE_MANAGER";
  requestedName?: string;
  status?: AccessRequestStatus;
}

// Creates an AccessRequest row directly, bypassing the creation API — used
// when a test needs an existing pending (or already-reviewed) request as a
// fixture, not as the thing under test. Returns the raw statusToken
// alongside the row since only its hash is ever persisted.
export async function createTestAccessRequest(options: CreateTestAccessRequestOptions) {
  const password = options.password ?? "Test1234!";
  const passwordHash = await bcrypt.hash(password, 12);
  const statusToken = crypto.randomBytes(32).toString("hex");
  const statusTokenHash = crypto.createHash("sha256").update(statusToken).digest("hex");

  const request = await prisma.accessRequest.create({
    data: {
      organizationId: options.organizationId,
      email: options.email ?? `requester-${crypto.randomUUID()}@example.com`,
      passwordHash,
      requestedRole: options.requestedRole ?? Role.EMPLOYEE,
      requestedName: options.requestedName ?? "Test Requester",
      statusTokenHash,
      status: options.status ?? AccessRequestStatus.PENDING,
    },
  });

  return { request, statusToken, password };
}
