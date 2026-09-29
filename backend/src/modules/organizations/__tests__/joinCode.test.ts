import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

describe("Organization join code", () => {
  it("is generated automatically for a new organization and is unique per organization", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");

    expect(orgA.joinCode).toEqual(expect.any(String));
    expect(orgA.joinCode.length).toBeGreaterThan(0);
    expect(orgA.joinCode).not.toBe(orgB.joinCode);
  });

  it("is not derived from the organization id or name", async () => {
    const org = await createTestOrganization("A Very Distinctive Organization Name");
    expect(org.joinCode).not.toContain(org.id.replace(/-/g, "").toUpperCase());
    expect(org.joinCode.toLowerCase()).not.toContain("distinctive");
  });

  it("SUPER_ADMIN organization creation also generates a join code", async () => {
    const { user, password } = await createTestUser({ role: Role.SUPER_ADMIN, organizationId: null });
    const token = await loginAs(user.email, password);

    const res = await request(app).post("/api/organizations").set("Authorization", `Bearer ${token}`).send({ name: "New Co" });

    expect(res.status).toBe(201);
    expect(res.body.joinCode).toEqual(expect.any(String));
  });

  it("ORGANIZATION_ADMIN can retrieve their own organization's join code through the existing settings endpoint", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app).get(`/api/organizations/${org.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.joinCode).toBe(org.joinCode);
  });

  it("existing organization update behavior remains intact after adding joinCode", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId: org.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed Co" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Co");
    expect(res.body.joinCode).toBe(org.joinCode);
  });
});

describe("GET /api/organizations/lookup", () => {
  it("returns only {id, name} for a valid, active code", async () => {
    const org = await createTestOrganization("Lookup Co");

    const res = await request(app).get("/api/organizations/lookup").query({ code: org.joinCode });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: org.id, name: "Lookup Co" });
  });

  it("does not require authentication", async () => {
    const org = await createTestOrganization();
    const res = await request(app).get("/api/organizations/lookup").query({ code: org.joinCode });
    expect(res.status).toBe(200);
  });

  it("returns a generic 404 for a code that doesn't exist", async () => {
    const res = await request(app).get("/api/organizations/lookup").query({ code: "NOPE12345" });
    expect(res.status).toBe(404);
  });

  it("returns the identical generic 404 for a real code belonging to an inactive organization", async () => {
    const org = await createTestOrganization();
    await prisma.organization.update({ where: { id: org.id }, data: { isActive: false } });

    const validCodeRes = await request(app).get("/api/organizations/lookup").query({ code: "DOES-NOT-EXIST" });
    const inactiveCodeRes = await request(app).get("/api/organizations/lookup").query({ code: org.joinCode });

    expect(inactiveCodeRes.status).toBe(404);
    expect(inactiveCodeRes.body.error.code).toBe(validCodeRes.body.error.code);
    expect(inactiveCodeRes.body.error.message).toBe(validCodeRes.body.error.message);
  });

  it("never exposes isActive, createdAt, or any field beyond id/name", async () => {
    const org = await createTestOrganization();
    const res = await request(app).get("/api/organizations/lookup").query({ code: org.joinCode });
    expect(Object.keys(res.body).sort()).toEqual(["id", "name"]);
  });

  it("rejects a missing code with a validation error, not a lookup", async () => {
    const res = await request(app).get("/api/organizations/lookup");
    expect(res.status).toBe(422);
  });

  it("the requester cannot inject/choose their own code — lookup only ever matches a real, server-generated joinCode", async () => {
    const res = await request(app).get("/api/organizations/lookup").query({ code: "ATTACKER-CHOSEN-CODE" });
    expect(res.status).toBe(404);
  });
});
