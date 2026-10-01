import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestEmployee,
  createTestManager,
  createTestOrganization,
  createTestStore,
  createTestUser,
} from "../../../../tests/factories";

/*
 * Reproduces the exact manually-discovered scenario, end to end, across
 * Attendance, AttendanceCorrection, Dashboard, and the Attendance report.
 *
 * Original bug: an organization with two employees (one per store), both
 * marked PRESENT on the same date. Attempting to change the second
 * employee's status to ABSENT — the only mechanism available before this
 * milestone was resubmitting the create form — was reported to leave 3
 * Attendance records (a duplicate for the second employee) instead of 2,
 * with the dashboard and report both reflecting the corrupted count.
 *
 * Root cause, established by inspection before any code changed: the
 * (employeeId, date) unique index and the service's P2002-to-409 handling
 * were both already present and correctly enforced (verified against the
 * live dev database directly, and by the pre-existing "returns 409 for a
 * duplicate employee/date attendance record" test) — so a second `create`
 * call was already rejected, not silently duplicated. The actual gap was
 * structural: there was no `update` path for status at all
 * (attendance.schemas.ts even documented this as deliberate), so the only
 * tool available to "change" a record was the create form — exactly the
 * wrong tool. This suite proves the new direct-edit and
 * correction-approval paths, both pure updates, produce the correct,
 * expected state.
 */

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

describe("exact regression scenario — direct admin edit", () => {
  it("2 employees x 1 store each, both PRESENT, admin edits one to ABSENT: exactly 2 rows, correct dashboard and report", async () => {
    const org = await createTestOrganization();
    const store1 = await createTestStore(org.id, "Store 1");
    const store2 = await createTestStore(org.id, "Store 2");
    const { employee: employee101 } = await createTestEmployee({ organizationId: org.id, storeId: store1.id, name: "Employee 101" });
    const { employee: employee201 } = await createTestEmployee({ organizationId: org.id, storeId: store2.id, name: "Employee 201" });

    const { user: adminUser, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId: org.id });
    const token = await loginAs(adminUser.email, password);

    const date = "2026-10-01";

    const create101 = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee101.id, date, status: "PRESENT", method: "MANUAL" });
    const create201 = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee201.id, date, status: "PRESENT", method: "MANUAL" });

    expect(create101.status).toBe(201);
    expect(create201.status).toBe(201);

    // Step 3: Organization Admin edits employee 201: PRESENT -> ABSENT.
    const editRes = await request(app)
      .patch(`/api/attendance/${create201.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ABSENT" });
    expect(editRes.status).toBe(200);
    expect(editRes.body.status).toBe("ABSENT");

    // Step 4/5: exactly 2 Attendance records, correct statuses.
    const allRecords = await prisma.attendance.findMany({ where: { organizationId: org.id, date: new Date(date) } });
    expect(allRecords).toHaveLength(2);
    const byEmployee = new Map(allRecords.map((r) => [r.employeeId, r]));
    expect(byEmployee.get(employee101.id)?.status).toBe("PRESENT");
    expect(byEmployee.get(employee201.id)?.status).toBe("ABSENT");

    // Step 6: dashboard — derived from real records, not hardcoded.
    const dashboardRes = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${token}`)
      .query({ startDate: date, endDate: date });
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.attendance).toEqual({
      present: 1,
      absent: 1,
      total: 2,
      attendanceRate: 50,
    });

    // Step 7: Attendance report — same real-record derivation.
    const reportRes = await request(app)
      .get("/api/reports/attendance")
      .set("Authorization", `Bearer ${token}`)
      .query({ startDate: date, endDate: date });
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.summary).toEqual({ present: 1, absent: 1, total: 2, attendanceRate: 50 });

    const report101 = reportRes.body.employees.find((e: { employeeId: string }) => e.employeeId === employee101.id);
    const report201 = reportRes.body.employees.find((e: { employeeId: string }) => e.employeeId === employee201.id);
    expect(report101).toMatchObject({ present: 1, absent: 0, total: 1, attendanceRate: 100 });
    expect(report201).toMatchObject({ present: 0, absent: 1, total: 1, attendanceRate: 0 });

    // Step 8: the direct edit created no AttendanceCorrection.
    const corrections = await request(app)
      .get("/api/attendance-corrections")
      .set("Authorization", `Bearer ${token}`)
      .query({ attendanceId: create201.body.id });
    expect(corrections.body).toHaveLength(0);
  });
});

describe("exact regression scenario — manager correction path", () => {
  it("manager requests PRESENT -> ABSENT, admin approves: existing row changes, no second row is created", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });

    const { user: adminUser, password: adminPassword } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId: org.id });
    const adminToken = await loginAs(adminUser.email, adminPassword);

    const { user: managerUser, password: managerPassword } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(managerUser.email, managerPassword);

    const date = "2026-10-01";
    const createRes = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: employee.id, date, status: "PRESENT", method: "MANUAL" });
    expect(createRes.status).toBe(201);

    // Manager requests the correction.
    const correctionRes = await request(app)
      .post("/api/attendance-corrections")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ attendanceId: createRes.body.id, proposedStatus: "ABSENT", reason: "Employee called in sick." });
    expect(correctionRes.status).toBe(201);
    expect(correctionRes.body.status).toBe("PENDING");

    // Admin approves.
    const approveRes = await request(app)
      .post(`/api/attendance-corrections/${correctionRes.body.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");

    // Existing row changed; no second row for this employee/date.
    const rows = await prisma.attendance.findMany({ where: { employeeId: employee.id, date: new Date(date) } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(createRes.body.id);
    expect(rows[0]?.status).toBe("ABSENT");
  });
});
