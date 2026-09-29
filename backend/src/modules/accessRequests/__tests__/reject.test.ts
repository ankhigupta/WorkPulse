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

describe("POST /api/access-requests/:requestId/reject", () => {
  it("rejects a PENDING request, records reviewer/timestamp, creates no User", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });
    const usersBefore = await prisma.user.count();

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    expect(res.body.reviewedByUserId).toBe(admin.userId);
    expect(res.body.reviewedAt).toEqual(expect.any(String));
    expect(res.body.createdUserId).toBeNull();
    expect(await prisma.user.count()).toBe(usersBefore);
  });

  it("accepts an optional rejection reason and stores it", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app)
      .post(`/api/access-requests/${accessRequest.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reason: "Could not verify identity" });

    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Could not verify identity");
  });

  it("is final for that request — the requester may submit a new one later, no cooldown", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id, email: "rohan@example.com" });

    await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({});

    const resubmit = await request(app).post("/api/access-requests").send({
      organizationCode: org.joinCode,
      email: "rohan@example.com",
      password: "Test1234!",
      name: "Rohan Mehta",
      requestedRole: "EMPLOYEE",
    });

    expect(resubmit.status).toBe(201);
  });

  it("the requester-facing status endpoint does not expose the rejection reason (default: not exposed)", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest, statusToken } = await createTestAccessRequest({ organizationId: org.id });

    await request(app)
      .post(`/api/access-requests/${accessRequest.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ reason: "Internal admin-only note" });

    const statusRes = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: statusToken });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("REJECTED");
    expect(JSON.stringify(statusRes.body)).not.toMatch(/Internal admin-only note/);
    expect(statusRes.body.rejectionReason).toBeUndefined();
  });

  it("a second rejection of an already-rejected request is rejected safely", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const first = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({});
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({});
    expect(second.status).toBe(409);
  });

  it("rejecting an already-approved request is rejected safely", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id, status: "APPROVED" });

    const res = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({});

    expect(res.status).toBe(409);
  });

  it("concurrent double rejection of the same request: exactly one winner", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const [first, second] = await Promise.all([
      request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({}),
      request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${admin.token}`).send({}),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("cross-organization: an admin cannot reject a request belonging to another organization (404)", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const adminA = await createOrgAdmin(orgA.id);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: orgB.id });

    const res = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${adminA.token}`).send({});

    expect(res.status).toBe(404);
  });

  it("STORE_MANAGER cannot reject requests", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${token}`).send({});

    expect(res.status).toBe(403);
  });

  it("EMPLOYEE cannot reject requests", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).set("Authorization", `Bearer ${token}`).send({});

    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent requestId", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/access-requests/00000000-0000-0000-0000-000000000000/reject")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app).post(`/api/access-requests/${accessRequest.id}/reject`).send({});

    expect(res.status).toBe(401);
  });
});
