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

async function createPayroll(
  employeeId: string,
  storeId: string,
  organizationId: string,
  status: "DRAFT" | "FINALIZED",
  totalWage: number,
  periodStart: string,
  periodEnd: string,
  finalizedByUserId?: string,
) {
  return prisma.payroll.create({
    data: {
      employeeId,
      storeId,
      organizationId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalDaysPresent: 0,
      totalWage,
      status,
      ...(status === "FINALIZED" ? { finalizedAt: new Date(), finalizedByUserId } : {}),
    },
  });
}

async function createPayment(employeeId: string, organizationId: string, recordedByUserId: string, amount: number, paidAt: string) {
  return prisma.paymentLedger.create({
    data: { employeeId, organizationId, amount, paidAt: new Date(paidAt), recordedByUserId },
  });
}

async function setupScenario(dailyWage = 500) {
  const org = await createTestOrganization();
  const store = await createTestStore(org.id);
  const { employee, user } = await createTestEmployee({ organizationId: org.id, storeId: store.id, dailyWage });
  const admin = await createOrgAdmin(org.id);
  return { org, store, employee, employeeUser: user, admin };
}

const period = "?startDate=2026-01-01&endDate=2026-01-31";

describe("GET /api/reports/attendance", () => {
  it("ORG_ADMIN can access the report", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it("STORE_MANAGER can access the report", async () => {
    const { org, store } = await setupScenario();
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);
    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("STORE_MANAGER sees only their own store's attendance", async () => {
    const { org, store, employee, employeeUser, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-15"), status: "PRESENT" });
    await createTestAttendance({ employeeId: empB.id, storeId: storeB.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-15"), status: "PRESENT" });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${token}`);

    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].employeeId).toBe(employee.id);
    expect(res.body.employees[0].employeeName).toBe(employeeUser.email);
  });

  it("cross-store data is excluded even when a storeId filter for another store is supplied", async () => {
    const { org, store } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin2 = await createOrgAdmin(org.id);
    await createTestAttendance({ employeeId: empB.id, storeId: storeB.id, organizationId: org.id, markedByUserId: admin2.userId, date: new Date("2026-01-15"), status: "PRESENT" });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/reports/attendance${period}&storeId=${storeB.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.employees).toHaveLength(0);
  });

  it("cross-tenant data is excluded", async () => {
    const scenarioA = await setupScenario();
    const scenarioB = await setupScenario();
    await createTestAttendance({
      employeeId: scenarioA.employee.id,
      storeId: scenarioA.store.id,
      organizationId: scenarioA.org.id,
      markedByUserId: scenarioA.admin.userId,
      date: new Date("2026-01-15"),
      status: "PRESENT",
    });

    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${scenarioB.admin.token}`);

    expect(res.body.employees).toHaveLength(0);
    expect(res.body.summary.total).toBe(0);
  });

  it("computes present/absent counts and attendance rate correctly", async () => {
    const { org, store, admin } = await setupScenario();
    const { employee: e1 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createTestAttendance({ employeeId: e1.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-10"), status: "PRESENT" });
    await createTestAttendance({ employeeId: e1.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-11"), status: "ABSENT" });
    await createTestAttendance({ employeeId: e1.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-12"), status: "PRESENT" });

    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.summary).toEqual({ present: 2, absent: 1, total: 3, attendanceRate: 66.67 });
    expect(res.body.employees[0]).toMatchObject({ present: 2, absent: 1, total: 3, attendanceRate: 66.67 });
  });

  it("zero attendance returns rate 0, not NaN/Infinity", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.summary).toEqual({ present: 0, absent: 0, total: 0, attendanceRate: 0 });
    expect(res.body.employees).toEqual([]);
  });

  it("filters by employeeId", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-10"), status: "PRESENT" });
    await createTestAttendance({ employeeId: e2.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-10"), status: "PRESENT" });

    const res = await request(app)
      .get(`/api/reports/attendance${period}&employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].employeeId).toBe(employee.id);
  });

  it("filters by storeId (organization admin)", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-10"), status: "PRESENT" });
    await createTestAttendance({ employeeId: empB.id, storeId: storeB.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-10"), status: "PRESENT" });

    const res = await request(app)
      .get(`/api/reports/attendance${period}&storeId=${store.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].storeId).toBe(store.id);
  });

  it("excludes records on the day before/after the period boundary", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2025-12-31"), status: "PRESENT" });
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-02-01"), status: "PRESENT" });

    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.summary.total).toBe(0);
  });

  it("includes records exactly on the boundary dates", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-01"), status: "PRESENT" });
    await createTestAttendance({ employeeId: e2.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-31"), status: "PRESENT" });

    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.summary.total).toBe(2);
  });

  it("rejects an invalid startDate", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/reports/attendance?startDate=01-01-2026&endDate=2026-01-31").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });

  it("rejects startDate > endDate", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/reports/attendance?startDate=2026-01-31&endDate=2026-01-01").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });

  it("rejects a missing startDate/endDate", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/reports/attendance").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });
});

describe("GET /api/reports/payroll", () => {
  it("ORG_ADMIN sees organization-wide payroll", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);

    const res = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ draftTotal: "0.00", finalizedTotal: "1000.00", recordCount: 1 });
    expect(res.body.payroll[0]).toMatchObject({ employeeId: employee.id, totalWage: "1000.00", status: "FINALIZED" });
  });

  it("STORE_MANAGER sees only their own store's payroll", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayroll(empB.id, storeB.id, org.id, "FINALIZED", 5000, "2026-01-01", "2026-01-31", admin.userId);

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${token}`);

    expect(res.body.summary.finalizedTotal).toBe("1000.00");
    expect(res.body.payroll).toHaveLength(1);
  });

  it("cross-store payroll is excluded via storeId filter attempt", async () => {
    const { org, store } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin2 = await createOrgAdmin(org.id);
    await createPayroll(empB.id, storeB.id, org.id, "FINALIZED", 5000, "2026-01-01", "2026-01-31", admin2.userId);

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/reports/payroll${period}&storeId=${storeB.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.payroll).toHaveLength(0);
  });

  it("cross-tenant payroll is excluded", async () => {
    const scenarioA = await setupScenario();
    const scenarioB = await setupScenario();
    await createPayroll(scenarioA.employee.id, scenarioA.store.id, scenarioA.org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", scenarioA.admin.userId);

    const res = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${scenarioB.admin.token}`);

    expect(res.body.payroll).toHaveLength(0);
  });

  it("filters by status", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayroll(e2.id, store.id, org.id, "DRAFT", 500, "2026-01-01", "2026-01-31");

    const res = await request(app).get(`/api/reports/payroll${period}&status=DRAFT`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll).toHaveLength(1);
    expect(res.body.payroll[0].status).toBe("DRAFT");
    expect(res.body.summary.finalizedTotal).toBe("0.00");
  });

  it("filters by employeeId", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayroll(e2.id, store.id, org.id, "FINALIZED", 2000, "2026-01-01", "2026-01-31", admin.userId);

    const res = await request(app)
      .get(`/api/reports/payroll${period}&employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll).toHaveLength(1);
    expect(res.body.summary.finalizedTotal).toBe("1000.00");
  });

  it("uses inclusive period-overlap date filtering", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayroll(e2.id, store.id, org.id, "FINALIZED", 2000, "2026-03-01", "2026-03-31", admin.userId);

    const res = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll).toHaveLength(1);
  });

  it("preserves exact Decimal values for fractional wages", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 333.33, "2026-01-01", "2026-01-31", admin.userId);
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayroll(e2.id, store.id, org.id, "FINALIZED", 333.33, "2026-01-01", "2026-01-31", admin.userId);

    const res = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.summary.finalizedTotal).toBe("666.66");
  });

  it("returns an empty result set with correct summary when nothing matches", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.payroll).toEqual([]);
    expect(res.body.summary).toEqual({ draftTotal: "0.00", finalizedTotal: "0.00", recordCount: 0 });
  });
});

describe("GET /api/reports/payments", () => {
  it("ORG_ADMIN sees organization-wide payments", async () => {
    const { org, employee, admin } = await setupScenario();
    await createPayment(employee.id, org.id, admin.userId, 300, "2026-01-15T10:00:00.000Z");

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ totalPaid: "300.00", paymentCount: 1 });
  });

  it("STORE_MANAGER sees only their own store's payments", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    await createPayment(employee.id, org.id, admin.userId, 300, "2026-01-15T10:00:00.000Z");
    await createPayment(empB.id, org.id, admin.userId, 400, "2026-01-15T10:00:00.000Z");

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${token}`);

    expect(res.body.summary.totalPaid).toBe("300.00");
    expect(res.body.payments).toHaveLength(1);
  });

  it("cross-store payments are excluded", async () => {
    const { org, store } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin2 = await createOrgAdmin(org.id);
    await createPayment(empB.id, org.id, admin2.userId, 400, "2026-01-15T10:00:00.000Z");

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${token}`);

    expect(res.body.payments).toHaveLength(0);
  });

  it("cross-tenant payments are excluded", async () => {
    const scenarioA = await setupScenario();
    const scenarioB = await setupScenario();
    await createPayment(scenarioA.employee.id, scenarioA.org.id, scenarioA.admin.userId, 300, "2026-01-15T10:00:00.000Z");

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${scenarioB.admin.token}`);

    expect(res.body.payments).toHaveLength(0);
  });

  it("includes a payment made at any time on the end date (inclusive boundary)", async () => {
    const { org, employee, admin } = await setupScenario();
    await createPayment(employee.id, org.id, admin.userId, 100, "2026-01-31T23:59:59.000Z");

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payments).toHaveLength(1);
  });

  it("excludes a payment made on the day after the period", async () => {
    const { org, employee, admin } = await setupScenario();
    await createPayment(employee.id, org.id, admin.userId, 100, "2026-02-01T00:00:00.000Z");

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payments).toHaveLength(0);
  });

  it("filters by employeeId", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayment(employee.id, org.id, admin.userId, 100, "2026-01-15T10:00:00.000Z");
    await createPayment(e2.id, org.id, admin.userId, 200, "2026-01-15T10:00:00.000Z");

    const res = await request(app)
      .get(`/api/reports/payments${period}&employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payments).toHaveLength(1);
    expect(res.body.summary.totalPaid).toBe("100.00");
  });

  it("preserves exact Decimal amounts", async () => {
    const { org, employee, admin } = await setupScenario();
    await createPayment(employee.id, org.id, admin.userId, 111.11, "2026-01-15T10:00:00.000Z");
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: (await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).storeId });
    await createPayment(e2.id, org.id, admin.userId, 222.22, "2026-01-15T10:00:00.000Z");

    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.summary.totalPaid).toBe("333.33");
  });

  it("returns an empty result set with correct summary when nothing matches", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.payments).toEqual([]);
    expect(res.body.summary).toEqual({ totalPaid: "0.00", paymentCount: 0 });
  });
});

describe("GET /api/reports/workforce", () => {
  it("ORG_ADMIN sees organization-wide workforce", async () => {
    const { org, store, employeeUser } = await setupScenario();
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    void e2;
    const admin = await createOrgAdmin(org.id);

    const res = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalEmployees).toBe(2);
    expect(res.body.employees.some((e: { employeeName: string }) => e.employeeName === employeeUser.email)).toBe(true);
  });

  it("STORE_MANAGER sees only their own store's workforce", async () => {
    const { org, store, employee } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    await createTestEmployee({ organizationId: org.id, storeId: storeB.id });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${token}`);

    expect(res.body.summary.totalEmployees).toBe(1);
    expect(res.body.employees[0].employeeId).toBe(employee.id);
  });

  it("cross-store workforce is excluded via storeId filter attempt", async () => {
    const { org, store } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    await createTestEmployee({ organizationId: org.id, storeId: storeB.id });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/reports/workforce?storeId=${storeB.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.body.summary.totalEmployees).toBe(1);
  });

  it("cross-tenant workforce is excluded", async () => {
    const scenarioA = await setupScenario();
    const scenarioB = await setupScenario();

    const res = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${scenarioB.admin.token}`);

    expect(res.body.summary.totalEmployees).toBe(1);
    expect(res.body.employees.every((e: { employeeId: string }) => e.employeeId !== scenarioA.employee.id)).toBe(true);
  });

  it("activeOnly=true (default) excludes inactive employees from the list but counts them in summary", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await prisma.employee.update({ where: { id: employee.id }, data: { isActive: false } });
    await createTestEmployee({ organizationId: org.id, storeId: store.id });

    const res = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.summary).toEqual({ totalEmployees: 2, activeEmployees: 1, inactiveEmployees: 1 });
    expect(res.body.employees).toHaveLength(1);
  });

  it("activeOnly=false includes inactive employees in the list", async () => {
    const { employee, admin } = await setupScenario();
    await prisma.employee.update({ where: { id: employee.id }, data: { isActive: false } });

    const res = await request(app).get("/api/reports/workforce?activeOnly=false").set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].isActive).toBe(false);
  });

  it("filters by storeId (organization admin)", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    await createTestEmployee({ organizationId: org.id, storeId: storeB.id });

    const res = await request(app).get(`/api/reports/workforce?storeId=${store.id}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].employeeId).toBe(employee.id);
  });

  it("never exposes passwordHash or other sensitive User fields", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${admin.token}`);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("passwordHash");
    expect(bodyText).not.toContain("refreshToken");
  });
});

describe("authorization", () => {
  it("EMPLOYEE is denied on every report", async () => {
    const { org, store } = await setupScenario();
    const { user } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const attendanceRes = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${token}`);
    const payrollRes = await request(app).get(`/api/reports/payroll${period}`).set("Authorization", `Bearer ${token}`);
    const paymentsRes = await request(app).get(`/api/reports/payments${period}`).set("Authorization", `Bearer ${token}`);
    const workforceRes = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${token}`);

    expect([attendanceRes.status, payrollRes.status, paymentsRes.status, workforceRes.status]).toEqual([403, 403, 403, 403]);
  });

  it("SUPER_ADMIN is denied", async () => {
    const { user, password } = await createTestUser({ role: Role.SUPER_ADMIN, organizationId: null });
    const token = await loginAs(user.email, password);
    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("unauthenticated request is denied", async () => {
    const res = await request(app).get(`/api/reports/attendance${period}`);
    expect(res.status).toBe(401);
  });

  it("a STORE_MANAGER with no Manager association is rejected, not given org-wide data", async () => {
    const { org } = await setupScenario();
    const { user, password } = await createTestUser({ role: Role.STORE_MANAGER, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/reports/attendance${period}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
