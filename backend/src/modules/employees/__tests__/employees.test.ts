import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestManager,
  createTestOrganization,
  createTestStore,
  createTestUser,
} from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  return loginAs(user.email, password);
}

const validEmployeePayload = (storeId: string, overrides: Record<string, unknown> = {}) => ({
  name: "Rohan Mehta",
  email: `employee-${crypto.randomUUID()}@example.com`,
  password: "Test1234!",
  storeId,
  dailyWage: 500,
  joinedAt: "2026-01-15",
  ...overrides,
});

describe("POST /api/employees", () => {
  it("organization admin creates an employee in their organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      organizationId: org.id,
      storeId: store.id,
      name: "Rohan Mehta",
      dailyWage: "500",
      isActive: true,
    });
    expect(res.body.user).toMatchObject({ role: Role.EMPLOYEE, isActive: true });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("generates a QR token that is not the employee id, email, or otherwise predictable", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const payload = validEmployeePayload(store.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(res.body.qrCodeToken).toEqual(expect.any(String));
    expect(res.body.qrCodeToken).not.toBe(res.body.id);
    expect(res.body.qrCodeToken).not.toContain(payload.email);
  });

  it("rejects assigning an employee to another organization's store (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const foreignStore = await createTestStore(otherOrg.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(foreignStore.id));

    expect(res.status).toBe(404);
  });

  it("rejects a client-supplied organizationId (tenant escape attempt)", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id, { organizationId: otherOrg.id }));

    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const res = await request(app).post("/api/employees").send(validEmployeePayload(store.id));
    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    expect(res.status).toBe(403);
  });

  it("rejects STORE_MANAGER with 403 (read-only role for employees)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });

    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    expect(res.status).toBe(403);
  });

  it("rejects invalid input (missing required fields)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: store.id });

    expect(res.status).toBe(422);
  });

  it("rejects a missing name even when email/password are provided", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `employee-${crypto.randomUUID()}@example.com`,
        password: "Test1234!",
        storeId: store.id,
        dailyWage: 500,
        joinedAt: "2026-01-15",
      });

    expect(res.status).toBe(422);
  });

  it("organization admin can create an employee with no email/password/login account at all", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Rohan Mehta", storeId: store.id, dailyWage: 700, joinedAt: "2026-01-15" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Rohan Mehta", organizationId: org.id, storeId: store.id });
    expect(res.body.user).toBeNull();
  });

  it("rejects email supplied without a password", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Rohan Mehta", email: "rohan@example.com", storeId: store.id, dailyWage: 700, joinedAt: "2026-01-15" });

    expect(res.status).toBe(422);
  });

  it("rejects password supplied without an email", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Rohan Mehta", password: "Test1234!", storeId: store.id, dailyWage: 700, joinedAt: "2026-01-15" });

    expect(res.status).toBe(422);
  });

  it("rejects a negative dailyWage", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id, { dailyWage: -50 }));

    expect(res.status).toBe(422);
  });

  it("rejects a duplicate email (already-used account)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const payload = validEmployeePayload(store.id);

    await request(app).post("/api/employees").set("Authorization", `Bearer ${token}`).send(payload);
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...payload, storeId: store.id });

    expect(res.status).toBe(409);
  });
});

describe("GET /api/employees", () => {
  it("organization admin sees every employee in their organization", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const token = await createOrgAdmin(org.id);

    await request(app).post("/api/employees").set("Authorization", `Bearer ${token}`).send(validEmployeePayload(storeA.id));
    await request(app).post("/api/employees").set("Authorization", `Bearer ${token}`).send(validEmployeePayload(storeB.id));

    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("store manager only sees employees from their assigned store", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const adminToken = await createOrgAdmin(org.id);

    await request(app).post("/api/employees").set("Authorization", `Bearer ${adminToken}`).send(validEmployeePayload(storeA.id));
    await request(app).post("/api/employees").set("Authorization", `Bearer ${adminToken}`).send(validEmployeePayload(storeA.id));
    await request(app).post("/api/employees").set("Authorization", `Bearer ${adminToken}`).send(validEmployeePayload(storeB.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((e: { storeId: string }) => e.storeId === storeA.id)).toBe(true);
  });

  it("includes employees with no login account, correctly showing user: null", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);

    await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Rohan Mehta", storeId: store.id, dailyWage: 700, joinedAt: "2026-01-15" });

    const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: "Rohan Mehta" });
    expect(res.body[0].user).toBeNull();
  });
});

describe("GET /api/employees/:employeeId", () => {
  it("organization admin can retrieve an employee in their organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    const res = await request(app)
      .get(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("retrieves an employee with no login account, correctly showing user: null", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Rohan Mehta", storeId: store.id, dailyWage: 700, joinedAt: "2026-01-15" });

    const res = await request(app)
      .get(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Rohan Mehta");
    expect(res.body.user).toBeNull();
  });

  it("organization admin cannot access another organization's employee (404)", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const storeA = await createTestStore(orgA.id);
    const tokenA = await createOrgAdmin(orgA.id);
    const tokenB = await createOrgAdmin(orgB.id);

    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(validEmployeePayload(storeA.id));

    const res = await request(app)
      .get(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it("store manager can access an employee from their own store", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validEmployeePayload(store.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
  });

  it("store manager cannot access an employee from a different store (404)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validEmployeePayload(storeB.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/employees/:employeeId", () => {
  it("organization admin can update an employee", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dailyWage: 750 });

    expect(res.status).toBe(200);
    expect(res.body.dailyWage).toBe("750");
  });

  it("can deactivate an employee (isActive: false)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("can reactivate a previously deactivated employee", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it("rejects reassigning an employee to another organization's store (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const store = await createTestStore(org.id);
    const foreignStore = await createTestStore(otherOrg.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeId: foreignStore.id });

    expect(res.status).toBe(404);
  });

  it("store manager cannot update an employee (403)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validEmployeePayload(store.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it("rejects an attempt to change organizationId (unknown field)", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ organizationId: otherOrg.id });

    expect(res.status).toBe(422);
  });

  it("rejects an empty update body", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send(validEmployeePayload(store.id));

    const res = await request(app)
      .patch(`/api/employees/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});
