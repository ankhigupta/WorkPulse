import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import { createTestEmployee, createTestOrganization, createTestStore, createTestUser } from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  const token = await loginAs(user.email, password);
  return { token, userId: user.id };
}

async function setupScenario(dailyWage = 500) {
  const org = await createTestOrganization();
  const store = await createTestStore(org.id);
  const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id, dailyWage });
  const admin = await createOrgAdmin(org.id);
  return { org, store, employee, admin };
}

async function createFinalizedPayroll(
  employeeId: string,
  storeId: string,
  organizationId: string,
  finalizedByUserId: string,
  totalWage: number,
  periodStart = "2026-01-01",
  periodEnd = "2026-01-31",
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
      status: "FINALIZED",
      finalizedAt: new Date(),
      finalizedByUserId,
    },
  });
}

async function createDraftPayroll(
  employeeId: string,
  storeId: string,
  organizationId: string,
  totalWage: number,
  periodStart = "2026-01-01",
  periodEnd = "2026-01-31",
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
      status: "DRAFT",
    },
  });
}

const validPayload = (employeeId: string, overrides: Record<string, unknown> = {}) => ({
  employeeId,
  amount: 100,
  paidAt: new Date().toISOString(),
  note: "Cash payment",
  ...overrides,
});

describe("POST /api/payments", () => {
  it("organization admin can record a valid payment", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 300 }));

    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(employee.id);
    expect(res.body.amount).toBe("300");
  });

  it("organization ownership is derived correctly", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 100 }));

    expect(res.body.organizationId).toBe(org.id);
  });

  it("actor identity comes from req.auth.userId, never the client", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const someoneElse = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 100, recordedByUserId: someoneElse.userId }));

    // recordedByUserId isn't an accepted field at all — .strict() rejects it.
    expect(res.status).toBe(422);
  });

  it("rejects a client-supplied organizationId", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const otherOrg = await createTestOrganization();

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 100, organizationId: otherOrg.id }));

    expect(res.status).toBe(422);
  });

  it("rejects an employee belonging to another organization (404)", async () => {
    const { admin } = await setupScenario();
    const otherOrg = await createTestOrganization();
    const otherStore = await createTestStore(otherOrg.id);
    const { employee: otherEmployee } = await createTestEmployee({ organizationId: otherOrg.id, storeId: otherStore.id });

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(otherEmployee.id));

    expect(res.status).toBe(404);
  });

  it("rejects an invalid employeeId", async () => {
    const { admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload("not-a-uuid"));

    expect(res.status).toBe(422);
  });

  it("rejects a zero payment", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 0 }));

    expect(res.status).toBe(422);
  });

  it("rejects a negative payment", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: -50 }));

    expect(res.status).toBe(422);
  });

  it("rejects a payment amount supplied as a string", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: "100" }));

    expect(res.status).toBe(422);
  });

  it("rejects a payment with more than 2 decimal places", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 100.999 }));

    expect(res.status).toBe(422);
  });

  it("rejects an invalid paidAt date", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { paidAt: "not-a-date" }));

    expect(res.status).toBe(422);
  });

  it("rejects unknown fields", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 100, createdAt: new Date().toISOString() }));

    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const { employee } = await setupScenario();
    const res = await request(app).post("/api/payments").send(validPayload(employee.id));
    expect(res.status).toBe(401);
  });

  it("rejects STORE_MANAGER role with 403", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const { user, password } = await createTestUser({ role: Role.STORE_MANAGER, organizationId: org.id });
    await prisma.manager.create({ data: { userId: user.id, organizationId: org.id, storeId: store.id, joinedAt: new Date() } });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { amount: 100 }));

    expect(res.status).toBe(403);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const { org, store } = await setupScenario();
    const { user, employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload(employee.id, { amount: 100 }));

    expect(res.status).toBe(403);
  });
});

describe("payment history", () => {
  it("organization admin can list payments in their organization", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100 }));
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 200 }));

    const res = await request(app).get("/api/payments").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("organization admin can retrieve a payment", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const createRes = await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100 }));

    const res = await request(app)
      .get(`/api/payments/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("cross-organization payment returns 404", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const createRes = await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100 }));
    const otherOrg = await createTestOrganization();
    const otherAdmin = await createOrgAdmin(otherOrg.id);

    const res = await request(app)
      .get(`/api/payments/${createRes.body.id}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });

  it("filters by employeeId", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await createFinalizedPayroll(empB.id, store.id, org.id, admin.userId, 1000, "2026-02-01", "2026-02-28");
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100 }));
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(empB.id, { amount: 100 }));

    const res = await request(app)
      .get(`/api/payments?employeeId=${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(employee.id);
  });

  it("filters by date range", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100, paidAt: "2026-01-15T10:00:00.000Z" }));
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100, paidAt: "2026-03-15T10:00:00.000Z" }));

    const res = await request(app)
      .get("/api/payments?startDate=2026-01-01&endDate=2026-01-31")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
  });

  it("returns payments newest-paidAt first", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const older = await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100, paidAt: "2026-01-05T10:00:00.000Z" }));
    const newer = await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100, paidAt: "2026-01-20T10:00:00.000Z" }));

    const res = await request(app).get("/api/payments").set("Authorization", `Bearer ${admin.token}`);

    expect(res.body[0].id).toBe(newer.body.id);
    expect(res.body[1].id).toBe(older.body.id);
  });
});

describe("append-only behavior", () => {
  it("no PATCH route exists", async () => {
    const { admin } = await setupScenario();
    const res = await request(app)
      .patch("/api/payments/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 1 });
    expect(res.status).toBe(404);
  });

  it("no DELETE route exists", async () => {
    const { admin } = await setupScenario();
    const res = await request(app)
      .delete("/api/payments/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it("an existing payment remains unchanged after being read again", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    const createRes = await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 100 }));

    const res = await request(app)
      .get(`/api/payments/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toEqual(createRes.body);
  });
});

describe("GET /api/payments/balance/:employeeId", () => {
  it("employee with no payroll has zero owed", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalOwed: "0", totalPaid: "0", outstanding: "0" });
  });

  it("only FINALIZED payroll contributes to total owed", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await createDraftPayroll(employee.id, store.id, org.id, 5000, "2026-02-01", "2026-02-28");

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.totalOwed).toBe("1000");
  });

  it("employee with finalized payroll but no payments has full outstanding amount", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toEqual({ totalOwed: "1000", totalPaid: "0", outstanding: "1000" });
  });

  it("multiple finalized payroll periods aggregate correctly", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000, "2026-01-01", "2026-01-31");
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1500, "2026-02-01", "2026-02-28");

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.totalOwed).toBe("2500");
  });

  it("multiple payments aggregate correctly", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 300 }));
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 200 }));

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.totalPaid).toBe("500");
    expect(res.body.outstanding).toBe("500");
  });

  it("employee with payments equal to payroll has zero outstanding", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 1000 }));

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.outstanding).toBe("0");
  });

  it("preserves Decimal precision across aggregation", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 333.33);
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 333.33, "2026-02-01", "2026-02-28");
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 111.11 }));

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body.totalOwed).toBe("666.66");
    expect(res.body.outstanding).toBe("555.55");
  });

  it("recording a payment does not mutate Payroll", async () => {
    const { org, store, employee, admin } = await setupScenario();
    const payroll = await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 400 }));

    const unchangedPayroll = await prisma.payroll.findUniqueOrThrow({ where: { id: payroll.id } });
    expect(unchangedPayroll.totalWage.toString()).toBe("1000");
    expect(unchangedPayroll.status).toBe("FINALIZED");
  });

  it("cross-organization balance access returns 404", async () => {
    const { employee, admin } = await setupScenario();
    void admin;
    const otherOrg = await createTestOrganization();
    const otherAdmin = await createOrgAdmin(otherOrg.id);

    const res = await request(app)
      .get(`/api/payments/balance/${employee.id}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });
});

describe("overpayment", () => {
  it("rejects a payment that would exceed the outstanding balance", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 1500 }));

    expect(res.status).toBe(409);
  });

  it("accepts a payment that exactly matches the outstanding balance", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 1000 }));

    expect(res.status).toBe(201);
  });

  it("rejects a payment when the employee has zero outstanding balance (no payroll at all)", async () => {
    const { employee, admin } = await setupScenario();

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 1 }));

    expect(res.status).toBe(409);
  });

  it("a second payment that would exceed the remaining balance is rejected", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);
    await request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 700 }));

    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(validPayload(employee.id, { amount: 400 }));

    expect(res.status).toBe(409);
  });

  it("two simultaneous payments that together would exceed the balance: exactly one succeeds", async () => {
    const { org, store, employee, admin } = await setupScenario();
    await createFinalizedPayroll(employee.id, store.id, org.id, admin.userId, 1000);

    const [first, second] = await Promise.all([
      request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 700 })),
      request(app).post("/api/payments").set("Authorization", `Bearer ${admin.token}`).send(validPayload(employee.id, { amount: 700 })),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const totalPaid = await prisma.paymentLedger.aggregate({ where: { employeeId: employee.id }, _sum: { amount: true } });
    expect(totalPaid._sum.amount?.toString()).toBe("700");
  });
});
