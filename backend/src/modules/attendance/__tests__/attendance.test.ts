import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestEmployee,
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

const validPayload = (employeeId: string, overrides: Record<string, unknown> = {}) => ({
  employeeId,
  date: "2026-01-15",
  status: "PRESENT",
  method: "MANUAL",
  ...overrides,
});

describe("POST /api/attendance", () => {
  it("organization admin can create attendance for an employee in their organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employeeId: employee.id,
      storeId: store.id,
      organizationId: org.id,
      status: "PRESENT",
      method: "MANUAL",
    });
    expect(res.body.date).toBe("2026-01-15T00:00:00.000Z");
  });

  it("store manager can create attendance for an employee in their own store", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id));

    expect(res.status).toBe(201);
    expect(res.body.storeId).toBe(store.id);
  });

  it("store manager cannot create attendance for an employee in another store (404)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id));

    expect(res.status).toBe(404);
  });

  it("rejects an employee belonging to another organization (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const otherStore = await createTestStore(otherOrg.id);
    const { employee } = await createTestEmployee({ organizationId: otherOrg.id, storeId: otherStore.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id));

    expect(res.status).toBe(404);
  });

  it("rejects a well-formed but nonexistent employeeId (404)", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload("00000000-0000-0000-0000-000000000000"));

    expect(res.status).toBe(404);
  });

  it("rejects a malformed employeeId (422)", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload("not-a-uuid"));

    expect(res.status).toBe(422);
  });

  it("rejects an invalid date format", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { date: "15-01-2026" }));

    expect(res.status).toBe(422);
  });

  it("rejects a datetime-with-no-timezone string for date (would be timezone-ambiguous)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { date: "2026-01-15T10:00:00" }));

    expect(res.status).toBe(422);
  });

  it("rejects an invalid status", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { status: "LATE" }));

    expect(res.status).toBe(422);
  });

  it("rejects an invalid method", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { method: "BIOMETRIC" }));

    expect(res.status).toBe(422);
  });

  it("returns 409 for a duplicate employee/date attendance record", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));
    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { status: "ABSENT" }));

    expect(res.status).toBe(409);
  });

  it("concurrent duplicate attendance creation for the same employee/date: exactly one succeeds", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const [first, second] = await Promise.all([
      request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id)),
      request(app)
        .post("/api/attendance")
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload(employee.id, { status: "ABSENT" })),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const listRes = await request(app)
      .get("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .query({ employeeId: employee.id });
    expect(listRes.body).toHaveLength(1);
  });

  it("rejects a client-supplied organizationId (tenant escape attempt)", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { organizationId: otherOrg.id }));

    expect(res.status).toBe(422);
  });

  it("ignores/rejects a client-supplied storeId — there is no such input field", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { storeId: storeB.id }));

    // .strict() schema — storeId isn't an accepted creation field at all.
    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/attendance").send(validPayload("00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id));

    expect(res.status).toBe(403);
  });
});

describe("GET /api/attendance", () => {
  it("organization admin lists attendance across their organization's stores", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const token = await createOrgAdmin(org.id);

    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empA.id));
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empB.id));

    const res = await request(app).get("/api/attendance").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("store manager sees only attendance from their assigned store", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const adminToken = await createOrgAdmin(org.id);

    await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(empA.id));
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(empB.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app).get("/api/attendance").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].storeId).toBe(storeA.id);
  });

  it("a client-supplied storeId filter cannot widen a store manager's own scope", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const adminToken = await createOrgAdmin(org.id);
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(empB.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/attendance?storeId=${storeB.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("filters by exact date", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id, { date: "2026-01-15" }));

    const match = await request(app).get("/api/attendance?date=2026-01-15").set("Authorization", `Bearer ${token}`);
    const noMatch = await request(app).get("/api/attendance?date=2026-01-16").set("Authorization", `Bearer ${token}`);

    expect(match.body).toHaveLength(1);
    expect(noMatch.body).toHaveLength(0);
  });

  it("filters by employeeId", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empA.id));
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empB.id));

    const res = await request(app)
      .get(`/api/attendance?employeeId=${empA.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(empA.id);
  });

  it("filters by storeId (organization admin)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const token = await createOrgAdmin(org.id);
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empA.id));
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empB.id));

    const res = await request(app)
      .get(`/api/attendance?storeId=${storeA.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].storeId).toBe(storeA.id);
  });

  it("filters by status", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empA.id, { status: "PRESENT" }));
    await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(empB.id, { status: "ABSENT" }));

    const res = await request(app).get("/api/attendance?status=ABSENT").set("Authorization", `Bearer ${token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("ABSENT");
  });

  it("rejects an unrecognized query parameter", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);

    const res = await request(app).get("/api/attendance?foo=bar").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});

describe("GET /api/attendance/:attendanceId", () => {
  it("organization admin can retrieve their own attendance record", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    const res = await request(app)
      .get(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("organization admin cannot retrieve another organization's attendance (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const tokenA = await createOrgAdmin(org.id);
    const tokenB = await createOrgAdmin(otherOrg.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${tokenA}`).send(validPayload(employee.id));

    const res = await request(app)
      .get(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it("store manager cannot retrieve another store's attendance (404)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(employee.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/attendance/:attendanceId", () => {
  it("organization admin can update the method field", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ method: "QR" });

    expect(res.status).toBe(200);
    expect(res.body.method).toBe("QR");
  });

  it("store manager can update method for their own store's attendance", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(employee.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ method: "QR" });

    expect(res.status).toBe(200);
  });

  it("store manager cannot update another store's attendance (404)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(employee.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ method: "QR" });

    expect(res.status).toBe(404);
  });

  it("cross-organization update is rejected (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const tokenA = await createOrgAdmin(org.id);
    const tokenB = await createOrgAdmin(otherOrg.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${tokenA}`).send(validPayload(employee.id));

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ method: "QR" });

    expect(res.status).toBe(404);
  });

  it("organization admin can change status directly via PATCH: PRESENT -> ABSENT", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ABSENT" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ABSENT");
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("organization admin can change status directly via PATCH: ABSENT -> PRESENT", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { status: "ABSENT" }));

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PRESENT" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PRESENT");
  });

  it("a direct status edit updates the existing row — no second Attendance row is created", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ABSENT" });

    const listRes = await request(app)
      .get("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .query({ employeeId: employee.id });

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
    expect(listRes.body[0].status).toBe("ABSENT");
  });

  it("a direct status edit records who made it and when, without changing markedByUserId", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    expect(createRes.body.statusChangedByUserId).toBeNull();
    expect(createRes.body.statusChangedAt).toBeNull();

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ABSENT" });

    expect(res.body.statusChangedByUserId).toEqual(expect.any(String));
    expect(res.body.statusChangedAt).toEqual(expect.any(String));
    expect(res.body.markedByUserId).toBe(createRes.body.markedByUserId);
  });

  it("store manager cannot change status directly — rejected as an unrecognized field (422)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const adminToken = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${adminToken}`).send(validPayload(employee.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "ABSENT" });

    expect(res.status).toBe(422);

    const unchanged = await request(app)
      .get(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(unchanged.body.status).toBe("PRESENT");
  });

  it("a direct edit creates no AttendanceCorrection record", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ABSENT" });

    const corrections = await request(app)
      .get("/api/attendance-corrections")
      .set("Authorization", `Bearer ${token}`)
      .query({ attendanceId: createRes.body.id });

    expect(corrections.body).toHaveLength(0);
  });

  it("does not allow changing employeeId, organizationId, storeId, or id", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ method: "QR", organizationId: otherOrg.id });

    expect(res.status).toBe(422);
  });

  it("rejects an empty update body", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/attendance").set("Authorization", `Bearer ${token}`).send(validPayload(employee.id));

    const res = await request(app)
      .patch(`/api/attendance/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .patch("/api/attendance/00000000-0000-0000-0000-000000000000")
      .send({ method: "QR" });

    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .patch("/api/attendance/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ method: "QR" });

    expect(res.status).toBe(403);
  });
});
