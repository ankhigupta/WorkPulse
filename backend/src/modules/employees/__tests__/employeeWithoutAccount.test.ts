import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import { createTestManager, createTestOrganization, createTestStore, createTestUser } from "../../../../tests/factories";

// This file exercises the exact scenario this milestone introduced: an
// Employee with no phone/email/login account at all, whose attendance is
// always recorded by their STORE_MANAGER, and who must still work
// normally through attendance, payroll, payments, and reports. Matches
// the ticket's own "Rohan Mehta" example end to end.

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  const token = await loginAs(user.email, password);
  return { token, userId: user.id };
}

async function setupScenario() {
  const org = await createTestOrganization();
  const store = await createTestStore(org.id);
  const admin = await createOrgAdmin(org.id);
  const { user: managerUser, password: managerPassword } = await createTestManager({
    organizationId: org.id,
    storeId: store.id,
  });
  const managerToken = await loginAs(managerUser.email, managerPassword);

  const createRes = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ name: "Rohan Mehta", storeId: store.id, dailyWage: 700, joinedAt: "2026-01-15" });

  return { org, store, admin, managerToken, employee: createRes.body };
}

describe("employee with no login account — full lifecycle", () => {
  it("has no User association at all", async () => {
    const { employee } = await setupScenario();
    expect(employee.user).toBeNull();

    const dbRow = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(dbRow.userId).toBeNull();
  });

  it("store manager can manually record attendance for that employee", async () => {
    const { managerToken, employee } = await setupScenario();

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: employee.id, date: "2026-01-20", status: "PRESENT", method: "MANUAL" });

    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(employee.id);
    expect(res.body.status).toBe("PRESENT");
  });

  it("records the authenticated manager (not the employee) as markedByUserId", async () => {
    const { managerToken, employee } = await setupScenario();
    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${managerToken}`);

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: employee.id, date: "2026-01-20", status: "PRESENT", method: "MANUAL" });

    expect(res.body.markedByUserId).toBe(meRes.body.id);
  });

  it("contributes to payroll exactly like any other employee", async () => {
    const { admin, managerToken, employee } = await setupScenario();

    await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: employee.id, date: "2026-01-20", status: "PRESENT", method: "MANUAL" });
    await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: employee.id, date: "2026-01-21", status: "PRESENT", method: "MANUAL" });

    const payrollRes = await request(app)
      .post("/api/payroll")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(payrollRes.status).toBe(201);
    expect(payrollRes.body.totalDaysPresent).toBe(2);
    expect(payrollRes.body.totalWage).toBe("1400");
  });

  it("can have a payment recorded", async () => {
    const { admin, employee } = await setupScenario();
    await prisma.payroll.create({
      data: {
        employeeId: employee.id,
        storeId: employee.storeId,
        organizationId: employee.organizationId,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        totalDaysPresent: 2,
        totalWage: 1400,
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedByUserId: admin.userId,
      },
    });

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, amount: 1000, paidAt: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(employee.id);
  });

  it("appears correctly in the Workforce report with its real name", async () => {
    const { admin, employee } = await setupScenario();

    const res = await request(app).get("/api/reports/workforce").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const row = res.body.employees.find((e: { employeeId: string }) => e.employeeId === employee.id);
    expect(row).toMatchObject({ employeeName: "Rohan Mehta" });
  });

  it("appears correctly in the Attendance report", async () => {
    const { admin, managerToken, employee } = await setupScenario();
    await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: employee.id, date: "2026-01-20", status: "PRESENT", method: "MANUAL" });

    const res = await request(app)
      .get("/api/reports/attendance?startDate=2026-01-01&endDate=2026-01-31")
      .set("Authorization", `Bearer ${admin.token}`);

    const row = res.body.employees.find((e: { employeeId: string }) => e.employeeId === employee.id);
    expect(row).toMatchObject({ employeeName: "Rohan Mehta", present: 1 });
  });

  it("appears correctly in the Payroll report", async () => {
    const { admin, employee } = await setupScenario();
    await prisma.payroll.create({
      data: {
        employeeId: employee.id,
        storeId: employee.storeId,
        organizationId: employee.organizationId,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        totalDaysPresent: 1,
        totalWage: 700,
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedByUserId: admin.userId,
      },
    });

    const res = await request(app)
      .get("/api/reports/payroll?startDate=2026-01-01&endDate=2026-01-31")
      .set("Authorization", `Bearer ${admin.token}`);

    const row = res.body.payroll.find((p: { employeeId: string }) => p.employeeId === employee.id);
    expect(row).toMatchObject({ employeeName: "Rohan Mehta", totalWage: "700.00" });
  });

  it("cross-tenant isolation still holds for an account-less employee", async () => {
    const { employee } = await setupScenario();
    const otherOrg = await createTestOrganization();
    const otherAdmin = await createOrgAdmin(otherOrg.id);

    const res = await request(app)
      .get(`/api/employees/${employee.id}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });

  it("store-manager isolation still holds for an account-less employee in another store", async () => {
    const { org, employee } = await setupScenario();
    const otherStore = await createTestStore(org.id, "Other Store");
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: otherStore.id });
    const otherManagerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/employees/${employee.id}`)
      .set("Authorization", `Bearer ${otherManagerToken}`);

    expect(res.status).toBe(404);
  });

  it("never exposes password hashes or authentication secrets", async () => {
    const { employee } = await setupScenario();
    const bodyText = JSON.stringify(employee);
    expect(bodyText).not.toContain("passwordHash");
    expect(bodyText).not.toContain("refreshToken");
  });
});
