import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestAttendance,
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
  const token = await loginAs(user.email, password);
  return { token, userId: user.id };
}

// Builds a full org -> store -> employee -> attendance chain, ready for a
// correction to be requested against.
async function setupScenario(orgName = "Org") {
  const org = await createTestOrganization(orgName);
  const store = await createTestStore(org.id);
  const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
  const admin = await createOrgAdmin(org.id);
  const attendance = await createTestAttendance({
    employeeId: employee.id,
    storeId: store.id,
    organizationId: org.id,
    markedByUserId: admin.userId,
    status: "PRESENT",
  });
  return { org, store, employee, admin, attendance };
}

const validPayload = (attendanceId: string, overrides: Record<string, unknown> = {}) => ({
  attendanceId,
  proposedStatus: "ABSENT",
  reason: "Employee called in sick, marked present by mistake.",
  ...overrides,
});

describe("POST /api/attendance-corrections", () => {
  it("store manager can create a correction for attendance in their own store", async () => {
    const { store, org, attendance } = await setupScenario();
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(attendance.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      attendanceId: attendance.id,
      organizationId: org.id,
      proposedStatus: "ABSENT",
      status: "PENDING",
      requestedByUserId: user.id,
      reviewedByUserId: null,
      reviewedAt: null,
    });
  });

  it("organization admin can create a correction within their organization", async () => {
    const { admin, attendance } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(attendance.id));

    expect(res.status).toBe(201);
    expect(res.body.requestedByUserId).toBe(admin.userId);
  });

  it("store manager cannot create a correction for another store's attendance (404)", async () => {
    const { org, attendance } = await setupScenario();
    const otherStore = await createTestStore(org.id, "Other Store");
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: otherStore.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(attendance.id));

    expect(res.status).toBe(404);
  });

  it("organization admin cannot create a correction for another organization's attendance (404)", async () => {
    const { attendance } = await setupScenario("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const otherAdmin = await createOrgAdmin(otherOrg.id);

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${otherAdmin.token}`)
      .send(validPayload(attendance.id));

    expect(res.status).toBe(404);
  });

  it("rejects an invalid attendanceId (malformed UUID)", async () => {
    const { admin } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload("not-a-uuid"));

    expect(res.status).toBe(422);
  });

  it("rejects a well-formed but nonexistent attendanceId (404)", async () => {
    const { admin } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload("00000000-0000-0000-0000-000000000000"));

    expect(res.status).toBe(404);
  });

  it("rejects an invalid proposedStatus", async () => {
    const { admin, attendance } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(attendance.id, { proposedStatus: "LATE" }));

    expect(res.status).toBe(422);
  });

  it("rejects a missing reason", async () => {
    const { admin, attendance } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ attendanceId: attendance.id, proposedStatus: "ABSENT" });

    expect(res.status).toBe(422);
  });

  it("rejects a client-supplied organizationId (tenant escape attempt)", async () => {
    const { admin, attendance } = await setupScenario("Org A");
    const otherOrg = await createTestOrganization("Org B");

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(attendance.id, { organizationId: otherOrg.id }));

    expect(res.status).toBe(422);
  });

  it("rejects client-supplied status/reviewer/timestamp fields", async () => {
    const { admin, attendance } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(attendance.id, { status: "APPROVED", reviewedAt: new Date().toISOString() }));

    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const { attendance } = await setupScenario();
    const res = await request(app).post("/api/attendance-corrections").send(validPayload(attendance.id));
    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const { store, org, attendance } = await setupScenario();
    const { user } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(attendance.id));

    expect(res.status).toBe(403);
  });
});

describe("GET /api/attendance-corrections", () => {
  it("organization admin lists corrections across their organization", async () => {
    const { org, admin, attendance } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const attendanceB = await createTestAttendance({
      employeeId: empB.id,
      storeId: storeB.id,
      organizationId: org.id,
      markedByUserId: admin.userId,
    });

    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));

    const res = await request(app).get("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("store manager lists only corrections for their assigned store", async () => {
    const { org, admin, attendance, store } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const attendanceB = await createTestAttendance({
      employeeId: empB.id,
      storeId: storeB.id,
      organizationId: org.id,
      markedByUserId: admin.userId,
    });
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app).get("/api/attendance-corrections").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].attendanceId).toBe(attendance.id);
  });

  it("a client-supplied storeId filter cannot widen a store manager's own scope", async () => {
    const { org, admin, store } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const attendanceB = await createTestAttendance({
      employeeId: empB.id,
      storeId: storeB.id,
      organizationId: org.id,
      markedByUserId: admin.userId,
    });
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/attendance-corrections?storeId=${storeB.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("filters by status", async () => {
    const { org, admin, attendance } = await setupScenario();
    const attendanceB = await createTestAttendance({
      employeeId: (await createTestEmployee({ organizationId: org.id, storeId: attendance.storeId })).employee.id,
      storeId: attendance.storeId,
      organizationId: org.id,
      markedByUserId: admin.userId,
      date: new Date("2026-02-01"),
    });
    const correctionA = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));
    await request(app).post(`/api/attendance-corrections/${correctionA.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app).get("/api/attendance-corrections?status=PENDING").set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].attendanceId).toBe(attendanceB.id);
  });

  it("filters by employeeId", async () => {
    const { org, admin, attendance, employee } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: attendance.storeId });
    const attendanceB = await createTestAttendance({
      employeeId: empB.id,
      storeId: attendance.storeId,
      organizationId: org.id,
      markedByUserId: admin.userId,
      date: new Date("2026-02-01"),
    });
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));

    const res = await request(app)
      .get(`/api/attendance-corrections?employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].attendanceId).toBe(attendance.id);
  });

  it("filters by attendanceId", async () => {
    const { org, admin, attendance } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: attendance.storeId });
    const attendanceB = await createTestAttendance({
      employeeId: empB.id,
      storeId: attendance.storeId,
      organizationId: org.id,
      markedByUserId: admin.userId,
      date: new Date("2026-02-01"),
    });
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));

    const res = await request(app)
      .get(`/api/attendance-corrections?attendanceId=${attendance.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].attendanceId).toBe(attendance.id);
  });

  it("filters by date range (via the referenced attendance's date)", async () => {
    const { org, admin, attendance } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: attendance.storeId });
    const attendanceB = await createTestAttendance({
      employeeId: empB.id,
      storeId: attendance.storeId,
      organizationId: org.id,
      markedByUserId: admin.userId,
      date: new Date("2026-03-01"),
    });
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendanceB.id));

    const res = await request(app)
      .get("/api/attendance-corrections?startDate=2026-02-01&endDate=2026-02-28")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(0);

    const res2 = await request(app)
      .get("/api/attendance-corrections?startDate=2026-01-01&endDate=2026-01-31")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res2.body).toHaveLength(1);
    expect(res2.body[0].attendanceId).toBe(attendance.id);
  });
});

describe("GET /api/attendance-corrections/:correctionId", () => {
  it("organization admin can retrieve an accessible correction", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .get(`/api/attendance-corrections/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("store manager can retrieve an accessible correction", async () => {
    const { admin, attendance, store, org } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/attendance-corrections/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
  });

  it("cross-organization correction returns 404", async () => {
    const { admin, attendance } = await setupScenario("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const otherAdmin = await createOrgAdmin(otherOrg.id);
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .get(`/api/attendance-corrections/${createRes.body.id}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });

  it("cross-store correction returns 404 for a store manager", async () => {
    const { admin, attendance, org } = await setupScenario();
    const otherStore = await createTestStore(org.id, "Other Store");
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: otherStore.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/attendance-corrections/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/attendance-corrections/:correctionId/approve", () => {
  it("organization admin can approve a PENDING correction", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("approval changes Attendance.status to the proposed status", async () => {
    const { admin, attendance } = await setupScenario();
    expect(attendance.status).toBe("PRESENT");
    const createRes = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(attendance.id, { proposedStatus: "ABSENT" }));

    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const updatedAttendance = await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } });
    expect(updatedAttendance.status).toBe("ABSENT");
  });

  it("approval records reviewer and review timestamp correctly", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.reviewedByUserId).toBe(admin.userId);
    expect(res.body.reviewedAt).not.toBeNull();
  });

  it("the approved correction remains as a permanent audit record", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .get(`/api/attendance-corrections/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("store manager cannot approve (403)", async () => {
    const { admin, attendance, store, org } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });

  it("EMPLOYEE cannot approve (403)", async () => {
    const { admin, attendance, store, org } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    const { user } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("cross-organization approval returns 404", async () => {
    const { admin, attendance } = await setupScenario("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const otherAdmin = await createOrgAdmin(otherOrg.id);
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });

  it("an already-APPROVED correction cannot be approved again (409)", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(409);
  });

  it("an already-REJECTED correction cannot be approved (409)", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/reject`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(409);
  });
});

describe("POST /api/attendance-corrections/:correctionId/reject", () => {
  it("organization admin can reject a PENDING correction", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
  });

  it("rejection does not change Attendance.status", async () => {
    const { admin, attendance } = await setupScenario();
    expect(attendance.status).toBe("PRESENT");
    const createRes = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(attendance.id, { proposedStatus: "ABSENT" }));

    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/reject`).set("Authorization", `Bearer ${admin.token}`);

    const unchangedAttendance = await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } });
    expect(unchangedAttendance.status).toBe("PRESENT");
  });

  it("rejection records reviewer correctly", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.reviewedByUserId).toBe(admin.userId);
    expect(res.body.reviewedAt).not.toBeNull();
  });

  it("store manager cannot reject (403)", async () => {
    const { admin, attendance, store, org } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/reject`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });

  it("an already-APPROVED correction cannot be rejected (409)", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(409);
  });

  it("an already-REJECTED correction cannot be rejected again (409)", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    await request(app).post(`/api/attendance-corrections/${createRes.body.id}/reject`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(409);
  });
});

describe("concurrency / data integrity", () => {
  it("two simultaneous approve requests on the same correction cannot both succeed", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const [first, second] = await Promise.all([
      request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`),
      request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalAttendance = await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } });
    expect(finalAttendance.status).toBe("ABSENT");
  });

  it("an approve racing a reject on the same correction: exactly one wins", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));

    const [approveRes, rejectRes] = await Promise.all([
      request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`),
      request(app).post(`/api/attendance-corrections/${createRes.body.id}/reject`).set("Authorization", `Bearer ${admin.token}`),
    ]);

    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalCorrection = await prisma.attendanceCorrection.findUniqueOrThrow({ where: { id: createRes.body.id } });
    expect(["APPROVED", "REJECTED"]).toContain(finalCorrection.status);
  });

  it("a failed (already-processed) approval leaves the prior approval's reviewer/timestamp untouched", async () => {
    const { admin, attendance } = await setupScenario();
    const createRes = await request(app).post("/api/attendance-corrections").set("Authorization", `Bearer ${admin.token}`).send(validPayload(attendance.id));
    const firstApprove = await request(app).post(`/api/attendance-corrections/${createRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const secondAdmin = await createOrgAdmin(attendance.organizationId);
    const secondApprove = await request(app)
      .post(`/api/attendance-corrections/${createRes.body.id}/approve`)
      .set("Authorization", `Bearer ${secondAdmin.token}`);

    expect(secondApprove.status).toBe(409);

    const finalCorrection = await prisma.attendanceCorrection.findUniqueOrThrow({ where: { id: createRes.body.id } });
    expect(finalCorrection.reviewedByUserId).toBe(firstApprove.body.reviewedByUserId);
    expect(finalCorrection.reviewedAt?.toISOString()).toBe(firstApprove.body.reviewedAt);
  });
});
