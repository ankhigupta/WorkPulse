import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { Role } from "../../../generated/prisma/enums";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  return loginAs(user.email, password);
}

describe("POST /api/stores", () => {
  it("ORGANIZATION_ADMIN can create a store in their own organization", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Downtown Store", address: "123 Main St" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Downtown Store", organizationId: org.id, isActive: true });
  });

  it("ignores/rejects a client-supplied organizationId (tenant escape attempt)", async () => {
    const org = await createTestOrganization("Real Org");
    const otherOrg = await createTestOrganization("Target Org");
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Escape Attempt", organizationId: otherOrg.id });

    // organizationId is not in the schema at all — .strict() means this is
    // a validation error, not a silently-ignored field.
    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/stores").send({ name: "No Auth Store" });
    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE with 403", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.EMPLOYEE, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Employee Store" });

    expect(res.status).toBe(403);
  });

  it("rejects SUPER_ADMIN (stores are ORGANIZATION_ADMIN only in this milestone)", async () => {
    const { user, password } = await createTestUser({ role: Role.SUPER_ADMIN, organizationId: null });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Super Admin Store" });

    expect(res.status).toBe(403);
  });

  it("rejects a duplicate store name within the same organization", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);

    await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Only One Of Me" });

    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Only One Of Me" });

    expect(res.status).toBe(409);
  });

  it("allows the same store name across different organizations", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const tokenA = await createOrgAdmin(orgA.id);
    const tokenB = await createOrgAdmin(orgB.id);

    const resA = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Shared Name" });
    const resB = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Shared Name" });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
  });

  it("rejects an empty name with a validation error", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/stores", () => {
  it("lists only the caller's own organization's stores", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const tokenA = await createOrgAdmin(orgA.id);
    const tokenB = await createOrgAdmin(orgB.id);

    await request(app).post("/api/stores").set("Authorization", `Bearer ${tokenA}`).send({ name: "A Store 1" });
    await request(app).post("/api/stores").set("Authorization", `Bearer ${tokenA}`).send({ name: "A Store 2" });
    await request(app).post("/api/stores").set("Authorization", `Bearer ${tokenB}`).send({ name: "B Store 1" });

    const res = await request(app).get("/api/stores").set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((s: { organizationId: string }) => s.organizationId === orgA.id)).toBe(true);
  });
});

describe("GET /api/stores/:storeId", () => {
  it("returns a store belonging to the caller's organization", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Findable Store" });

    const res = await request(app)
      .get(`/api/stores/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("returns 404 for a store belonging to a different organization (tenant isolation)", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const tokenA = await createOrgAdmin(orgA.id);
    const tokenB = await createOrgAdmin(orgB.id);

    const createRes = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A's Store" });

    const res = await request(app)
      .get(`/api/stores/${createRes.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/stores/:storeId", () => {
  it("updates a store belonging to the caller's organization", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Before" });

    const res = await request(app)
      .patch(`/api/stores/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "After", isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("After");
    expect(res.body.isActive).toBe(false);
  });

  it("cannot update a store belonging to a different organization (404)", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const tokenA = await createOrgAdmin(orgA.id);
    const tokenB = await createOrgAdmin(orgB.id);

    const createRes = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A's Store" });

    const res = await request(app)
      .patch(`/api/stores/${createRes.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("rejects renaming a store to a name already used in the same organization", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);
    await request(app).post("/api/stores").set("Authorization", `Bearer ${token}`).send({ name: "Taken Name" });
    const createRes = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamable" });

    const res = await request(app)
      .patch(`/api/stores/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Taken Name" });

    expect(res.status).toBe(409);
  });

  it("rejects an empty update body", async () => {
    const org = await createTestOrganization();
    const token = await createOrgAdmin(org.id);
    const createRes = await request(app)
      .post("/api/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Store" });

    const res = await request(app)
      .patch(`/api/stores/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});
