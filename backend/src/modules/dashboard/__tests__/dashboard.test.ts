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
  const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id, dailyWage });
  const admin = await createOrgAdmin(org.id);
  return { org, store, employee, admin };
}

const inPeriod = "2026-01-15";
const periodQuery = "?startDate=2026-01-01&endDate=2026-01-31";

describe("GET /api/dashboard/summary — organization admin", () => {
  it("can access the dashboard", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it("sees organization-wide store/employee/manager counts", async () => {
    const { org, store, admin } = await setupScenario();
    const storeB = await createTestStore(org.id, "Store B");
    await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    await createTestManager({ organizationId: org.id, storeId: storeB.id });

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.stores.total).toBe(2);
    expect(res.body.employees.total).toBe(2); // setupScenario's employee + storeB's employee
    expect(res.body.managers.total).toBe(1);
    void store;
  });

  it("respects isActive for active counts", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await prisma.employee.update({ where: { id: employee.id }, data: { isActive: false } });
    const { employee: activeEmp } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    void activeEmp;

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.employees.total).toBe(2);
    expect(res.body.employees.active).toBe(1);
  });

  it("sees organization-wide attendance totals", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date(inPeriod), status: "PRESENT" });

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.attendance.present).toBe(1);
    expect(res.body.attendance.total).toBe(1);
  });

  it("sees organization-wide payroll totals", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: employee2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayroll(employee2.id, store.id, org.id, "DRAFT", 500, "2026-01-01", "2026-01-31");

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll.finalizedTotal).toBe("1000");
    expect(res.body.payroll.draftTotal).toBe("500");
  });

  it("sees organization-wide payment totals", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayment(employee.id, org.id, admin.userId, 300, "2026-01-10T10:00:00.000Z");

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payments.totalPaid).toBe("300");
    expect(res.body.payments.totalOutstanding).toBe("700");
  });
});

describe("GET /api/dashboard/summary — store manager", () => {
  async function setupTwoStoreScenario() {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id, dailyWage: 500 });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id, dailyWage: 500 });
    const admin = await createOrgAdmin(org.id);
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);
    return { org, storeA, storeB, empA, empB, admin, managerToken };
  }

  it("can access the dashboard", async () => {
    const { managerToken } = await setupTwoStoreScenario();
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });

  it("sees only their own store's counts", async () => {
    const { managerToken } = await setupTwoStoreScenario();
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${managerToken}`);
    expect(res.body.stores.total).toBe(1);
    expect(res.body.employees.total).toBe(1);
  });

  it("another store's employees are excluded", async () => {
    const { storeB, org, managerToken } = await setupTwoStoreScenario();
    const { employee: extraEmp } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    void extraEmp;
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${managerToken}`);
    expect(res.body.employees.total).toBe(1);
  });

  it("another store's attendance is excluded", async () => {
    const { storeA, storeB, empA, empB, org, admin, managerToken } = await setupTwoStoreScenario();
    await createTestAttendance({ employeeId: empA.id, storeId: storeA.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date(inPeriod), status: "PRESENT" });
    await createTestAttendance({ employeeId: empB.id, storeId: storeB.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date(inPeriod), status: "PRESENT" });

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${managerToken}`);

    expect(res.body.attendance.present).toBe(1);
  });

  it("another store's payroll is excluded", async () => {
    const { storeA, storeB, empA, empB, org, admin, managerToken } = await setupTwoStoreScenario();
    await createPayroll(empA.id, storeA.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayroll(empB.id, storeB.id, org.id, "FINALIZED", 5000, "2026-01-01", "2026-01-31", admin.userId);

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${managerToken}`);

    expect(res.body.payroll.finalizedTotal).toBe("1000");
  });

  it("another store's payments are excluded", async () => {
    const { storeA, storeB, empA, empB, org, admin, managerToken } = await setupTwoStoreScenario();
    await createPayroll(empA.id, storeA.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayroll(empB.id, storeB.id, org.id, "FINALIZED", 1000, "2026-01-01", "2026-01-31", admin.userId);
    await createPayment(empA.id, org.id, admin.userId, 200, "2026-01-10T10:00:00.000Z");
    await createPayment(empB.id, org.id, admin.userId, 400, "2026-01-10T10:00:00.000Z");

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${managerToken}`);

    expect(res.body.payments.totalPaid).toBe("200");
    expect(res.body.payments.totalOutstanding).toBe("800");
  });
});

describe("cross-tenant isolation", () => {
  it("organization A's data never appears for organization B", async () => {
    const scenarioA = await setupScenario();
    const scenarioB = await setupScenario();
    await createTestAttendance({
      employeeId: scenarioA.employee.id,
      storeId: scenarioA.store.id,
      organizationId: scenarioA.org.id,
      markedByUserId: scenarioA.admin.userId,
      date: new Date(inPeriod),
      status: "PRESENT",
    });

    const res = await request(app)
      .get(`/api/dashboard/summary${periodQuery}`)
      .set("Authorization", `Bearer ${scenarioB.admin.token}`);

    expect(res.body.attendance.present).toBe(0);
    expect(res.body.employees.total).toBe(1); // only org B's own employee
    expect(res.body.organization.id).toBe(scenarioB.org.id);
  });
});

describe("attendance calculations", () => {
  it("computes PRESENT/ABSENT totals and attendance rate correctly", async () => {
    const { org, store, admin } = await setupScenario();
    const { employee: e1 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { employee: e2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { employee: e3 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createTestAttendance({ employeeId: e1.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date(inPeriod), status: "PRESENT" });
    await createTestAttendance({ employeeId: e2.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date(inPeriod), status: "PRESENT" });
    await createTestAttendance({ employeeId: e3.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date(inPeriod), status: "ABSENT" });

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.attendance.present).toBe(2);
    expect(res.body.attendance.absent).toBe(1);
    expect(res.body.attendance.total).toBe(3);
    expect(res.body.attendance.attendanceRate).toBeCloseTo(66.67, 1);
  });

  it("a zero-attendance period returns rate 0, not NaN/Infinity", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.attendance.total).toBe(0);
    expect(res.body.attendance.attendanceRate).toBe(0);
  });
});

describe("payroll calculations", () => {
  it("DRAFT payroll is included in draftTotal but excluded from outstanding", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "DRAFT", 5000, "2026-01-01", "2026-01-31");

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll.draftTotal).toBe("5000");
    expect(res.body.payments.totalOutstanding).toBe("0");
  });

  it("FINALIZED payroll is included in finalizedTotal", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 1200, "2026-01-01", "2026-01-31", admin.userId);

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll.finalizedTotal).toBe("1200");
  });
});

describe("date filtering", () => {
  it("records inside the selected period are included; records outside are excluded", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-15"), status: "PRESENT" });
    await createTestAttendance({
      employeeId: (await createTestEmployee({ organizationId: org.id, storeId: store.id })).employee.id,
      storeId: store.id,
      organizationId: org.id,
      markedByUserId: admin.userId,
      date: new Date("2026-03-01"),
      status: "PRESENT",
    });

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.attendance.total).toBe(1);
  });

  it("boundary dates (exactly startDate/endDate) are included", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createTestAttendance({ employeeId: employee.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-01"), status: "PRESENT" });
    const { employee: emp2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createTestAttendance({ employeeId: emp2.id, storeId: store.id, organizationId: org.id, markedByUserId: admin.userId, date: new Date("2026-01-31"), status: "PRESENT" });

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.attendance.total).toBe(2);
  });

  it("defaults to the current calendar month when no dates are supplied", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.period.startDate).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe("authorization", () => {
  it("EMPLOYEE is denied", async () => {
    const { org, store } = await setupScenario();
    const { user } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN is denied", async () => {
    const { user, password } = await createTestUser({ role: Role.SUPER_ADMIN, organizationId: null });
    const token = await loginAs(user.email, password);
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("unauthenticated request is denied", async () => {
    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`);
    expect(res.status).toBe(401);
  });
});

describe("validation", () => {
  it("rejects an invalid startDate", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/dashboard/summary?startDate=01-01-2026&endDate=2026-01-31").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });

  it("rejects an invalid endDate", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/dashboard/summary?startDate=2026-01-01&endDate=not-a-date").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });

  it("rejects startDate after endDate", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/dashboard/summary?startDate=2026-01-31&endDate=2026-01-01").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });

  it("rejects an unknown query parameter", async () => {
    const { admin } = await setupScenario();
    const res = await request(app).get("/api/dashboard/summary?storeId=00000000-0000-0000-0000-000000000000").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });
});

describe("financial precision", () => {
  it("handles fractional wages/payments with exact Decimal precision", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createPayroll(employee.id, store.id, org.id, "FINALIZED", 333.33, "2026-01-01", "2026-01-31", admin.userId);
    const { employee: emp2 } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createPayroll(emp2.id, store.id, org.id, "FINALIZED", 333.33, "2026-01-01", "2026-01-31", admin.userId);
    await createPayment(employee.id, org.id, admin.userId, 111.11, "2026-01-10T10:00:00.000Z");

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.payroll.finalizedTotal).toBe("666.66");
    expect(res.body.payments.totalPaid).toBe("111.11");
    expect(res.body.payments.totalOutstanding).toBe("555.55");
  });
});

describe("store manager with no Manager association", () => {
  it("is rejected, not silently given org-wide data", async () => {
    const { org } = await setupScenario();
    // A STORE_MANAGER-role User with no corresponding Manager row at all.
    const { user, password } = await createTestUser({ role: Role.STORE_MANAGER, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/dashboard/summary${periodQuery}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
