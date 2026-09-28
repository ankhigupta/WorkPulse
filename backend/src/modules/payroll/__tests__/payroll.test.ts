import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestAttendance,
  createTestEmployee,
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

async function markDays(
  employeeId: string,
  storeId: string,
  organizationId: string,
  markedByUserId: string,
  entries: Array<{ date: string; status: "PRESENT" | "ABSENT" }>,
) {
  for (const entry of entries) {
    await createTestAttendance({
      employeeId,
      storeId,
      organizationId,
      markedByUserId,
      date: new Date(entry.date),
      status: entry.status,
    });
  }
}

async function setupScenario(dailyWage = 500) {
  const org = await createTestOrganization();
  const store = await createTestStore(org.id);
  const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id, dailyWage });
  const admin = await createOrgAdmin(org.id);
  return { org, store, employee, admin };
}

const period = { periodStart: "2026-01-01", periodEnd: "2026-01-31" };

describe("POST /api/payroll", () => {
  it("organization admin can create a valid payroll", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [
      { date: "2026-01-05", status: "PRESENT" },
      { date: "2026-01-06", status: "PRESENT" },
    ]);

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(employee.id);
    expect(res.body.storeId).toBe(store.id);
    expect(res.body.organizationId).toBe(org.id);
  });

  it("new payroll starts in DRAFT status", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.status).toBe("DRAFT");
    expect(res.body.finalizedAt).toBeNull();
    expect(res.body.finalizedByUserId).toBeNull();
  });

  it("returns 409 for a duplicate employee/period", async () => {
    const { employee, admin } = await setupScenario();
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.status).toBe(409);
  });

  it("rejects an employee belonging to another organization (404)", async () => {
    const { admin } = await setupScenario();
    const otherOrg = await createTestOrganization("Org B");
    const otherStore = await createTestStore(otherOrg.id);
    const { employee: otherEmployee } = await createTestEmployee({ organizationId: otherOrg.id, storeId: otherStore.id });

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: otherEmployee.id, ...period });

    expect(res.status).toBe(404);
  });

  it("rejects a client-supplied organizationId (tenant escape attempt)", async () => {
    const { employee, admin } = await setupScenario();
    const otherOrg = await createTestOrganization();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period, organizationId: otherOrg.id });

    expect(res.status).toBe(422);
  });

  it("rejects a client-supplied calculated amount", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period, totalWage: 99999, totalDaysPresent: 999 });

    expect(res.status).toBe(422);
  });

  it("rejects an invalid periodStart", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, periodStart: "01-01-2026", periodEnd: "2026-01-31" });

    expect(res.status).toBe(422);
  });

  it("rejects an invalid periodEnd", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, periodStart: "2026-01-01", periodEnd: "not-a-date" });

    expect(res.status).toBe(422);
  });

  it("rejects periodStart after periodEnd", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, periodStart: "2026-01-31", periodEnd: "2026-01-01" });

    expect(res.status).toBe(422);
  });

  it("rejects an invalid employeeId", async () => {
    const { admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: "not-a-uuid", ...period });

    expect(res.status).toBe(422);
  });

  it("rejects STORE_MANAGER role with 403", async () => {
    const { org, store, admin } = await setupScenario();
    const { user, password } = await createTestUser({ role: Role.STORE_MANAGER, organizationId: org.id });
    await prisma.manager.create({ data: { userId: user.id, organizationId: org.id, storeId: store.id, joinedAt: new Date() } });
    const token = await loginAs(user.email, password);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.status).toBe(403);
    void admin;
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const { org, store } = await setupScenario();
    const { user, employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const { employee } = await setupScenario();
    const res = await request(app).post("/api/payroll").send({ employeeId: employee.id, ...period });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/payroll", () => {
  it("lists payroll scoped to the caller's organization", async () => {
    const { org, employee, admin } = await setupScenario();
    const otherOrg = await createTestOrganization();
    const otherStore = await createTestStore(otherOrg.id);
    const { employee: otherEmployee } = await createTestEmployee({ organizationId: otherOrg.id, storeId: otherStore.id });
    const otherAdmin = await createOrgAdmin(otherOrg.id);

    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${otherAdmin.token}`).send({ employeeId: otherEmployee.id, ...period });

    const res = await request(app).get("/api/payroll").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].organizationId).toBe(org.id);
  });

  it("filters by employeeId", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, ...period });

    const res = await request(app)
      .get(`/api/payroll?employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(employee.id);
  });

  it("filters by storeId", async () => {
    const { org, employee, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, ...period });

    const res = await request(app)
      .get(`/api/payroll?storeId=${storeB.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(empB.id);
  });

  it("filters by status", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const payrollA = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, ...period });
    await request(app).post(`/api/payroll/${payrollA.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app).get("/api/payroll?status=FINALIZED").set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(employee.id);
  });

  it("filters by period window", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, periodStart: "2026-01-01", periodEnd: "2026-01-31" });
    await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, periodStart: "2026-02-01", periodEnd: "2026-02-28" });

    const res = await request(app)
      .get("/api/payroll?periodStart=2026-02-01")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(empB.id);
  });

  it("cross-tenant payroll retrieval returns 404", async () => {
    const { employee, admin } = await setupScenario();
    const otherOrg = await createTestOrganization();
    const otherAdmin = await createOrgAdmin(otherOrg.id);
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    const res = await request(app)
      .get(`/api/payroll/${createRes.body.id}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });
});

describe("payroll calculation", () => {
  it("calculates totalWage as dailyWage × count(PRESENT) within the period", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [
      { date: "2026-01-05", status: "PRESENT" },
      { date: "2026-01-06", status: "PRESENT" },
      { date: "2026-01-07", status: "ABSENT" },
      { date: "2026-01-08", status: "PRESENT" },
    ]);

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalDaysPresent).toBe(3);
    expect(res.body.totalWage).toBe("1500");
  });

  it("does not count attendance outside the payroll period", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [
      { date: "2025-12-31", status: "PRESENT" }, // just before the period
      { date: "2026-01-05", status: "PRESENT" },
      { date: "2026-02-01", status: "PRESENT" }, // just after the period
    ]);

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalDaysPresent).toBe(1);
    expect(res.body.totalWage).toBe("500");
  });

  it("a day with no attendance record at all is not paid", async () => {
    const { employee, admin } = await setupScenario(500);
    // No attendance records created for this employee at all.

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalDaysPresent).toBe(0);
    expect(res.body.totalWage).toBe("0");
  });

  it("an approved attendance correction affects payroll (via the updated Attendance.status)", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [{ date: "2026-01-10", status: "ABSENT" }]);
    const attendance = await prisma.attendance.findFirstOrThrow({ where: { employeeId: employee.id } });

    const correctionRes = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ attendanceId: attendance.id, proposedStatus: "PRESENT", reason: "Was actually present, marked incorrectly." });
    await request(app).post(`/api/attendance-corrections/${correctionRes.body.id}/approve`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalDaysPresent).toBe(1);
    expect(res.body.totalWage).toBe("500");
  });

  it("a rejected attendance correction does not affect payroll", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [{ date: "2026-01-10", status: "ABSENT" }]);
    const attendance = await prisma.attendance.findFirstOrThrow({ where: { employeeId: employee.id } });

    const correctionRes = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ attendanceId: attendance.id, proposedStatus: "PRESENT", reason: "Disputed." });
    await request(app).post(`/api/attendance-corrections/${correctionRes.body.id}/reject`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalDaysPresent).toBe(0);
    expect(res.body.totalWage).toBe("0");
  });

  it("a still-PENDING attendance correction does not affect payroll", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [{ date: "2026-01-10", status: "ABSENT" }]);
    const attendance = await prisma.attendance.findFirstOrThrow({ where: { employeeId: employee.id } });

    await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ attendanceId: attendance.id, proposedStatus: "PRESENT", reason: "Pending review." });

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalDaysPresent).toBe(0);
    expect(res.body.totalWage).toBe("0");
  });

  it("preserves Decimal precision for a fractional dailyWage", async () => {
    const { org, store, employee, admin } = await setupScenario(333.33);
    await markDays(employee.id, store.id, org.id, admin.userId, [
      { date: "2026-01-05", status: "PRESENT" },
      { date: "2026-01-06", status: "PRESENT" },
      { date: "2026-01-07", status: "PRESENT" },
    ]);

    const res = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, ...period });

    expect(res.body.totalWage).toBe("999.99");
  });
});

describe("DRAFT payroll", () => {
  it("can be recalculated", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    expect(createRes.body.totalDaysPresent).toBe(0);

    await markDays(employee.id, store.id, org.id, admin.userId, [
      { date: "2026-01-05", status: "PRESENT" },
      { date: "2026-01-06", status: "PRESENT" },
    ]);

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/recalculate`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalDaysPresent).toBe(2);
    expect(res.body.totalWage).toBe("1000");
  });

  it("recalculation reflects the employee's current dailyWage", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [{ date: "2026-01-05", status: "PRESENT" }]);
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    expect(createRes.body.totalWage).toBe("500");

    await prisma.employee.update({ where: { id: employee.id }, data: { dailyWage: 600 } });

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/recalculate`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.totalWage).toBe("600");
  });

  it("draft updates cannot modify protected ownership fields (no such input exists)", async () => {
    // Recalculate takes no body at all — there is no endpoint through which
    // employeeId/storeId/organizationId could ever be supplied post-creation.
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/recalculate`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: "00000000-0000-0000-0000-000000000000", organizationId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe(employee.id);
  });
});

describe("POST /api/payroll/:payrollId/finalize", () => {
  it("organization admin can finalize a DRAFT payroll", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/finalize`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINALIZED");
  });

  it("populates finalizedAt and finalizedByUserId correctly", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/finalize`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.finalizedAt).not.toBeNull();
    expect(res.body.finalizedByUserId).toBe(admin.userId);
  });

  it("finalized payroll cannot be recalculated", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/recalculate`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(409);
  });

  it("finalized payroll cannot be finalized again", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/finalize`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(409);
  });

  it("finalized payroll remains readable", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`);

    const res = await request(app)
      .get(`/api/payroll/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINALIZED");
  });

  it("unauthorized role cannot finalize (403)", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    const { user } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post(`/api/payroll/${createRes.body.id}/finalize`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe("integrity", () => {
  it("two simultaneous finalize requests cannot both succeed", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    const [first, second] = await Promise.all([
      request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`),
      request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("a finalize racing a recalculate: exactly one wins, finalized amount is not overwritten", async () => {
    const { org, store, employee, admin } = await setupScenario(500);
    await markDays(employee.id, store.id, org.id, admin.userId, [{ date: "2026-01-05", status: "PRESENT" }]);
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });

    await Promise.all([
      request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`),
      request(app).post(`/api/payroll/${createRes.body.id}/recalculate`).set("Authorization", `Bearer ${admin.token}`),
    ]);

    const finalPayroll = await prisma.payroll.findUniqueOrThrow({ where: { id: createRes.body.id } });
    expect(finalPayroll.status).toBe("FINALIZED");
    expect(finalPayroll.totalWage.toString()).toBe("500");
  });

  it("historical payroll remains accessible after the employee is deactivated", async () => {
    const { employee, admin } = await setupScenario();
    const createRes = await request(app).post("/api/payroll").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, ...period });
    await request(app).post(`/api/payroll/${createRes.body.id}/finalize`).set("Authorization", `Bearer ${admin.token}`);

    await prisma.employee.update({ where: { id: employee.id }, data: { isActive: false } });

    const res = await request(app)
      .get(`/api/payroll/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FINALIZED");
  });
});
