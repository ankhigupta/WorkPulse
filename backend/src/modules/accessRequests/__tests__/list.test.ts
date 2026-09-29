import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
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
  return token;
}

describe("GET /api/access-requests", () => {
  it("ORGANIZATION_ADMIN sees requests for their own organization", async () => {
    const org = await createTestOrganization();
    await createTestAccessRequest({ organizationId: org.id, email: "a@example.com" });
    await createTestAccessRequest({ organizationId: org.id, email: "b@example.com" });
    const token = await createOrgAdmin(org.id);

    const res = await request(app).get("/api/access-requests").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("does not include requests from another organization", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    await createTestAccessRequest({ organizationId: orgA.id, email: "a@example.com" });
    await createTestAccessRequest({ organizationId: orgB.id, email: "b@example.com" });
    const tokenA = await createOrgAdmin(orgA.id);

    const res = await request(app).get("/api/access-requests").set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].organizationId).toBe(orgA.id);
  });

  it("filters by status", async () => {
    const org = await createTestOrganization();
    await createTestAccessRequest({ organizationId: org.id, email: "pending@example.com", status: "PENDING" });
    await createTestAccessRequest({ organizationId: org.id, email: "approved@example.com", status: "APPROVED" });
    const token = await createOrgAdmin(org.id);

    const res = await request(app).get("/api/access-requests").query({ status: "PENDING" }).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe("pending@example.com");
  });

  it("never returns passwordHash or statusTokenHash", async () => {
    const org = await createTestOrganization();
    await createTestAccessRequest({ organizationId: org.id });
    const token = await createOrgAdmin(org.id);

    const res = await request(app).get("/api/access-requests").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    expect(JSON.stringify(res.body)).not.toMatch(/statusToken/i);
  });

  it("STORE_MANAGER cannot list access requests", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get("/api/access-requests").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("EMPLOYEE cannot list access requests", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get("/api/access-requests").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN does not get ORGANIZATION_ADMIN's organization-scoped access — this endpoint is not part of the platform console", async () => {
    const { user, password } = await createTestUser({ role: Role.SUPER_ADMIN, organizationId: null });
    const token = await loginAs(user.email, password);

    const res = await request(app).get("/api/access-requests").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/access-requests");
    expect(res.status).toBe(401);
  });
});
