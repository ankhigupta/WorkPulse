import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { Role } from "../../../generated/prisma/enums";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createSuperAdmin() {
  const { user, password } = await createTestUser({ role: Role.SUPER_ADMIN, organizationId: null });
  const token = await loginAs(user.email, password);
  return { user, token };
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  const token = await loginAs(user.email, password);
  return { user, token };
}

describe("POST /api/organizations", () => {
  it("SUPER_ADMIN can create an organization", async () => {
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .post("/api/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Acme Retail" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Acme Retail", isActive: true });
  });

  it("rejects ORGANIZATION_ADMIN with 403", async () => {
    const org = await createTestOrganization();
    const { token } = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Not Work" });

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/organizations").send({ name: "No Auth" });
    expect(res.status).toBe(401);
  });

  it("rejects an empty name with a validation error", async () => {
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .post("/api/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(res.status).toBe(422);
  });

  it("rejects an unknown field (e.g. attempting to set isActive at creation)", async () => {
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .post("/api/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sneaky Org", isActive: false });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/organizations", () => {
  it("SUPER_ADMIN can list all organizations", async () => {
    await createTestOrganization("Org One");
    await createTestOrganization("Org Two");
    const { token } = await createSuperAdmin();

    const res = await request(app).get("/api/organizations").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("rejects ORGANIZATION_ADMIN with 403 (list is SUPER_ADMIN only)", async () => {
    const org = await createTestOrganization();
    const { token } = await createOrgAdmin(org.id);

    const res = await request(app).get("/api/organizations").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("rejects EMPLOYEE with 403", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get("/api/organizations").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/organizations/:organizationId", () => {
  it("SUPER_ADMIN can get any organization", async () => {
    const org = await createTestOrganization("Target Org");
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .get(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(org.id);
  });

  it("ORGANIZATION_ADMIN can get their own organization", async () => {
    const org = await createTestOrganization();
    const { token } = await createOrgAdmin(org.id);

    const res = await request(app)
      .get(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(org.id);
  });

  it("ORGANIZATION_ADMIN cannot access another organization (404, not 403)", async () => {
    const ownOrg = await createTestOrganization("Own Org");
    const otherOrg = await createTestOrganization("Other Org");
    const { token } = await createOrgAdmin(ownOrg.id);

    const res = await request(app)
      .get(`/api/organizations/${otherOrg.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/organizations/:organizationId", () => {
  it("ORGANIZATION_ADMIN can rename their own organization", async () => {
    const org = await createTestOrganization("Old Name");
    const { token } = await createOrgAdmin(org.id);

    const res = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
  });

  it("ORGANIZATION_ADMIN cannot change isActive (rejected at validation)", async () => {
    const org = await createTestOrganization();
    const { token } = await createOrgAdmin(org.id);

    const res = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(422);
  });

  it("ORGANIZATION_ADMIN cannot update another organization (404)", async () => {
    const ownOrg = await createTestOrganization("Own Org");
    const otherOrg = await createTestOrganization("Other Org");
    const { token } = await createOrgAdmin(ownOrg.id);

    const res = await request(app)
      .patch(`/api/organizations/${otherOrg.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("SUPER_ADMIN can toggle isActive", async () => {
    const org = await createTestOrganization();
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("rejects an empty update body", async () => {
    const org = await createTestOrganization();
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});
