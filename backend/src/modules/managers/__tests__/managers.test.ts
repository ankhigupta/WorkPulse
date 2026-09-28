import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { Role } from "../../../generated/prisma/enums";
import { createTestOrganization, createTestStore, createTestUser } from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  return loginAs(user.email, password);
}

const validManagerPayload = (storeId: string, overrides: Record<string, unknown> = {}) => ({
  email: `manager-${crypto.randomUUID()}@example.com`,
  password: "Test1234!",
  storeId,
  joinedAt: "2026-01-15",
  ...overrides,
});

describe("POST /api/managers", () => {
  it("organization admin creates a manager assigned to a store in their organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ organizationId: org.id, storeId: store.id, isActive: true });
    expect(res.body.user).toMatchObject({ role: Role.STORE_MANAGER, isActive: true });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("rejects assigning a manager to another organization's store (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const foreignStore = await createTestStore(otherOrg.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(foreignStore.id));

    expect(res.status).toBe(404);
  });

  it("rejects a client-supplied organizationId (tenant escape attempt)", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id, { organizationId: otherOrg.id }));

    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const res = await request(app).post("/api/managers").send(validManagerPayload(store.id));
    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id));

    expect(res.status).toBe(403);
  });

  it("rejects invalid input (missing required fields)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: store.id });

    expect(res.status).toBe(422);
  });

  it("rejects a duplicate email (already-used account)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const payload = validManagerPayload(store.id);

    await request(app).post("/api/managers").set("Authorization", `Bearer ${token}`).send(payload);
    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...payload, storeId: store.id });

    expect(res.status).toBe(409);
  });

  it("rejects an email already used by an existing employee (cross-role duplicate)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const sharedEmail = `shared-${crypto.randomUUID()}@example.com`;

    await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Shared Email Employee", email: sharedEmail, password: "Test1234!", storeId: store.id, dailyWage: 400, joinedAt: "2026-01-01" });

    const res = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id, { email: sharedEmail }));

    expect(res.status).toBe(409);
  });
});

describe("GET /api/managers", () => {
  it("lists managers in the caller's organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    await request(app).post("/api/managers").set("Authorization", `Bearer ${token}`).send(validManagerPayload(store.id));
    await request(app).post("/api/managers").set("Authorization", `Bearer ${token}`).send(validManagerPayload(store.id));

    const res = await request(app).get("/api/managers").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("rejects EMPLOYEE with 403", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get("/api/managers").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/managers/:managerId", () => {
  it("retrieves a manager belonging to the caller's organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id));

    const res = await request(app)
      .get(`/api/managers/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("cannot access another organization's manager (404)", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const storeA = await createTestStore(orgA.id);
    const tokenA = await createOrgAdmin(orgA.id);
    const tokenB = await createOrgAdmin(orgB.id);

    const createRes = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(validManagerPayload(storeA.id));

    const res = await request(app)
      .get(`/api/managers/${createRes.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/managers/:managerId", () => {
  it("updates a manager's store assignment within the same organization", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(storeA.id));

    const res = await request(app)
      .patch(`/api/managers/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: storeB.id });

    expect(res.status).toBe(200);
    expect(res.body.storeId).toBe(storeB.id);
  });

  it("can deactivate a manager", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id));

    const res = await request(app)
      .patch(`/api/managers/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("rejects reassigning a manager to another organization's store (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const store = await createTestStore(org.id);
    const foreignStore = await createTestStore(otherOrg.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id));

    const res = await request(app)
      .patch(`/api/managers/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: foreignStore.id });

    expect(res.status).toBe(404);
  });

  it("rejects an empty update body", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/managers")
      .set("Authorization", `Bearer ${token}`)
      .send(validManagerPayload(store.id));

    const res = await request(app)
      .patch(`/api/managers/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});
