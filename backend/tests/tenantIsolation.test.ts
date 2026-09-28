import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/common/db/prisma";
import { Role } from "../src/generated/prisma/enums";
import { createTestOrganization, createTestUser } from "./factories";

describe("tenant isolation — authentication context", () => {
  it("preserves each user's own organizationId through login and /me", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const { user: userA, password: passA } = await createTestUser({ organizationId: orgA.id });
    const { user: userB, password: passB } = await createTestUser({ organizationId: orgB.id });

    const loginA = await request(app).post("/api/auth/login").send({ email: userA.email, password: passA });
    const loginB = await request(app).post("/api/auth/login").send({ email: userB.email, password: passB });

    expect(loginA.body.user.organizationId).toBe(orgA.id);
    expect(loginB.body.user.organizationId).toBe(orgB.id);

    const meA = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginA.body.accessToken}`);
    const meB = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginB.body.accessToken}`);

    expect(meA.body.organizationId).toBe(orgA.id);
    expect(meB.body.organizationId).toBe(orgB.id);
    expect(meA.body.organizationId).not.toBe(meB.body.organizationId);
  });
});

// No tenant-scoped business endpoint exists yet (Employees/Stores have a
// schema but no service/route layer). So this tests the actual mechanism
// tenant isolation depends on at the layer that exists today: the
// composite foreign keys built into the schema during the database-design
// milestone. Full HTTP-level cross-tenant access tests (e.g. "Org A's
// token can't list Org B's employees") should be added once a real
// org-scoped module exists with its own service-layer query filtering.
describe("tenant isolation — database-level composite FK enforcement", () => {
  it("rejects an Employee whose organizationId does not match its Store's organization", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const storeInOrgA = await prisma.store.create({ data: { name: "Store A", organizationId: orgA.id } });
    const { user } = await createTestUser({ organizationId: orgA.id, role: Role.EMPLOYEE });

    await expect(
      prisma.employee.create({
        data: {
          userId: user.id,
          organizationId: orgB.id, // mismatched: the store belongs to Org A
          storeId: storeInOrgA.id,
          name: "Test Employee",
          dailyWage: 100,
          joinedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects an Employee whose organizationId does not match its User's organization", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const storeInOrgB = await prisma.store.create({ data: { name: "Store B", organizationId: orgB.id } });
    const { user } = await createTestUser({ organizationId: orgA.id, role: Role.EMPLOYEE });

    await expect(
      prisma.employee.create({
        data: {
          userId: user.id, // this user belongs to Org A
          organizationId: orgB.id, // matches the store, but not the user
          storeId: storeInOrgB.id,
          name: "Test Employee",
          dailyWage: 100,
          joinedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("accepts an Employee whose organizationId matches both its Store and its User", async () => {
    const org = await createTestOrganization("Consistent Org");
    const store = await prisma.store.create({ data: { name: "Consistent Store", organizationId: org.id } });
    const { user } = await createTestUser({ organizationId: org.id, role: Role.EMPLOYEE });

    await expect(
      prisma.employee.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          storeId: store.id,
          name: "Test Employee",
          dailyWage: 100,
          joinedAt: new Date(),
        },
      }),
    ).resolves.toBeDefined();
  });
});
