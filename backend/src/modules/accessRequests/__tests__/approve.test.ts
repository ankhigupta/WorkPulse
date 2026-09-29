import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestAccessRequest,
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

describe("POST /api/access-requests/:requestId/approve", () => {
  it("approves an EMPLOYEE request: creates User(EMPLOYEE) + Employee atomically, links, marks APPROVED", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest, password } = await createTestAccessRequest({
      organizationId: org.id,
      email: "rohan@example.com",
      requestedRole: "EMPLOYEE",
      requestedName: "Rohan Mehta",
    });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 700 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.reviewedByUserId).toBe(admin.userId);
    expect(res.body.createdUserId).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.createdUserId } });
    expect(user.role).toBe("EMPLOYEE");
    expect(user.email).toBe("rohan@example.com");
    expect(user.organizationId).toBe(org.id);

    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: user.id } });
    expect(employee.name).toBe("Rohan Mehta");
    expect(employee.storeId).toBe(store.id);
    expect(Number(employee.dailyWage)).toBe(700);

    // Password hash copied verbatim — the requester's original password
    // still compares successfully against the new User's stored hash.
    expect(await bcrypt.compare(password, user.passwordHash)).toBe(true);
  });

  it("approves a STORE_MANAGER request: creates User(STORE_MANAGER) + Manager, no wage fields anywhere", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest, password } = await createTestAccessRequest({
      organizationId: org.id,
      requestedRole: "STORE_MANAGER",
    });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "STORE_MANAGER", storeId: store.id, joinedAt: "2026-01-15" });

    expect(res.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.createdUserId } });
    expect(user.role).toBe("STORE_MANAGER");

    const manager = await prisma.manager.findUniqueOrThrow({ where: { userId: user.id } });
    expect(manager.storeId).toBe(store.id);
    expect(await bcrypt.compare(password, user.passwordHash)).toBe(true);
  });

  it("the admin's chosen role overrides requestedRole — requested EMPLOYEE, approved as STORE_MANAGER", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({
      organizationId: org.id,
      requestedRole: "EMPLOYEE",
    });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "STORE_MANAGER", storeId: store.id, joinedAt: "2026-01-15" });

    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.createdUserId } });
    expect(user.role).toBe("STORE_MANAGER");
    await expect(prisma.manager.findUniqueOrThrow({ where: { userId: user.id } })).resolves.toBeTruthy();
  });

  it("admin can override the requester's stated name for an EMPLOYEE approval", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({
      organizationId: org.id,
      requestedName: "Requester's Own Name",
    });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500, name: "Admin-Assigned Name" });

    expect(res.status).toBe(200);
    const employee = await prisma.employee.findFirstOrThrow({ where: { userId: res.body.createdUserId } });
    expect(employee.name).toBe("Admin-Assigned Name");
  });

  it.each([
    { role: "ORGANIZATION_ADMIN" },
    { role: "SUPER_ADMIN" },
  ])("cannot approve a request into $role", async ({ role }) => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role, storeId: store.id, joinedAt: "2026-01-15" });

    expect(res.status).toBe(422);
  });

  it("EMPLOYEE approval requires dailyWage", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15" });

    expect(res.status).toBe(422);
  });

  it("EMPLOYEE approval rejects a non-positive dailyWage", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 0 });

    expect(res.status).toBe(422);
  });

  it("STORE_MANAGER approval rejects a dailyWage field outright (strict schema, no wage/payroll fields for managers)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id, requestedRole: "STORE_MANAGER" });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "STORE_MANAGER", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(422);
  });

  it("rejects a storeId belonging to another organization — the requester/admin cannot force a foreign store", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization("Other Org");
    const foreignStore = await createTestStore(otherOrg.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: foreignStore.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(404);
  });

  it("cross-organization: an admin cannot approve a request belonging to another organization (404)", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const storeB = await createTestStore(orgB.id);
    const adminA = await createOrgAdmin(orgA.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: orgB.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${adminA.token}`)
      .send({ role: "EMPLOYEE", storeId: storeB.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(404);
  });

  it("STORE_MANAGER cannot approve requests", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(403);
  });

  it("EMPLOYEE cannot approve requests", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(403);
  });

  it("a second approval of an already-approved request is rejected safely (no double User creation)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const first = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });
    expect(second.status).toBe(409);

    const employeeCount = await prisma.employee.count({ where: { userId: first.body.createdUserId } });
    expect(employeeCount).toBe(1);
  });

  it("approving an already-rejected request is rejected safely", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id, status: "REJECTED" });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(409);
  });

  it("concurrent double approval of the same request: exactly one winner", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const payload = { role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 };
    const [first, second] = await Promise.all([
      request(app).post(`/api/access-requests/${accessRequest.id}/approve`).set("Authorization", `Bearer ${admin.token}`).send(payload),
      request(app).post(`/api/access-requests/${accessRequest.id}/approve`).set("Authorization", `Bearer ${admin.token}`).send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const userCount = await prisma.user.count({ where: { email: (await prisma.accessRequest.findUniqueOrThrow({ where: { id: accessRequest.id } })).email } });
    expect(userCount).toBe(1);
  });

  it("concurrent approve vs reject on the same request: exactly one winner, and a failed approve rolls back (request stays valid, no orphaned User)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const [approveRes, rejectRes] = await Promise.all([
      request(app)
        .post(`/api/access-requests/${accessRequest.id}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 }),
      request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({}),
    ]);

    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const final = await prisma.accessRequest.findUniqueOrThrow({ where: { id: accessRequest.id } });
    expect(["APPROVED", "REJECTED"]).toContain(final.status);

    if (final.status === "APPROVED") {
      expect(final.createdUserId).toEqual(expect.any(String));
    } else {
      expect(final.createdUserId).toBeNull();
    }
  });

  it("approving a request whose email already belongs to a User elsewhere fails cleanly and leaves the request PENDING", async () => {
    // Same email, two different organizations, both PENDING (allowed per
    // the locked product decision) — approve one, then try to approve the
    // other: the second hits User.email's global unique constraint.
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const storeA = await createTestStore(orgA.id);
    const storeB = await createTestStore(orgB.id);
    const adminA = await createOrgAdmin(orgA.id);
    const adminB = await createOrgAdmin(orgB.id);

    const { request: requestA } = await createTestAccessRequest({ organizationId: orgA.id, email: "shared@example.com" });
    const { request: requestB } = await createTestAccessRequest({ organizationId: orgB.id, email: "shared@example.com" });

    const firstApprove = await request(app)
      .post(`/api/access-requests/${requestA.id}/approve`)
      .set("Authorization", `Bearer ${adminA.token}`)
      .send({ role: "EMPLOYEE", storeId: storeA.id, joinedAt: "2026-01-15", dailyWage: 500 });
    expect(firstApprove.status).toBe(200);

    const secondApprove = await request(app)
      .post(`/api/access-requests/${requestB.id}/approve`)
      .set("Authorization", `Bearer ${adminB.token}`)
      .send({ role: "EMPLOYEE", storeId: storeB.id, joinedAt: "2026-01-15", dailyWage: 500 });
    expect(secondApprove.status).toBe(409);

    // The losing request's transaction rolled back entirely — it's back
    // to PENDING, not stuck half-approved.
    const finalRequestB = await prisma.accessRequest.findUniqueOrThrow({ where: { id: requestB.id } });
    expect(finalRequestB.status).toBe("PENDING");
    expect(finalRequestB.createdUserId).toBeNull();
  });

  it("returns 404 for a non-existent requestId", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/access-requests/00000000-0000-0000-0000-000000000000/approve")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/approve`)
      .send({ role: "EMPLOYEE", storeId: store.id, joinedAt: "2026-01-15", dailyWage: 500 });

    expect(res.status).toBe(401);
  });
});
