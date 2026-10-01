import { describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import { bootstrapSuperAdmin } from "../superAdmin.service";
import { createTestUser } from "../../../../tests/factories";

describe("bootstrapSuperAdmin", () => {
  it("creates a SUPER_ADMIN with organizationId null and a hashed password", async () => {
    const email = "super1@example.com";
    const password = "Test1234!";

    const result = await bootstrapSuperAdmin(email, password);

    expect(result.created).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.role).toBe(Role.SUPER_ADMIN);
    expect(user.organizationId).toBeNull();
    expect(user.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, user.passwordHash)).toBe(true);
  });

  it("is idempotent — running it again for the same email creates no duplicate", async () => {
    const email = "super2@example.com";
    const password = "Test1234!";

    const first = await bootstrapSuperAdmin(email, password);
    const second = await bootstrapSuperAdmin(email, password);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("refuses to change the role of an existing non-SUPER_ADMIN account with the same email", async () => {
    const { user } = await createTestUser({ email: "existing-admin@example.com", role: Role.ORGANIZATION_ADMIN });

    await expect(bootstrapSuperAdmin(user.email, "Test1234!")).rejects.toThrow(/not SUPER_ADMIN/);

    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.role).toBe(Role.ORGANIZATION_ADMIN);
  });

  it("concurrent double-bootstrap of the same email: exactly one row, no error", async () => {
    const email = "super-concurrent@example.com";
    const password = "Test1234!";

    const [first, second] = await Promise.all([
      bootstrapSuperAdmin(email, password),
      bootstrapSuperAdmin(email, password),
    ]);

    expect(first.userId).toBe(second.userId);
    expect([first.created, second.created].filter(Boolean).length).toBe(1);

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("the bootstrapped account authenticates through the normal login endpoint, unchanged", async () => {
    const email = "super-login@example.com";
    const password = "Test1234!";
    await bootstrapSuperAdmin(email, password);

    const res = await request(app).post("/api/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(Role.SUPER_ADMIN);
    expect(res.body.user.organizationId).toBeNull();
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it("no public route exists to create a SUPER_ADMIN", async () => {
    // signup/organization always creates ORGANIZATION_ADMIN — there is no
    // request shape that produces SUPER_ADMIN through it.
    const res = await request(app).post("/api/auth/signup/organization").send({
      organizationName: "Should Not Grant Super Admin",
      email: "attempted-super@example.com",
      password: "Test1234!",
      role: "SUPER_ADMIN",
    });

    expect(res.status).toBe(422);
  });
});
