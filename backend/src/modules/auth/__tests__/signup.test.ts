import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { createTestUser } from "../../../../tests/factories";

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  organizationName: "Acme Retail",
  email: "owner@acme.example.com",
  password: "Test1234!",
  ...overrides,
});

describe("POST /api/auth/signup/organization", () => {
  it("creates an organization and an ORGANIZATION_ADMIN user atomically, and logs the admin in", async () => {
    const res = await request(app).post("/api/auth/signup/organization").send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      user: { email: "owner@acme.example.com", role: "ORGANIZATION_ADMIN" },
    });
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.user.organizationId).toEqual(expect.any(String));

    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: res.body.user.organizationId } });
    expect(organization.name).toBe("Acme Retail");
    expect(organization.isActive).toBe(true);
    expect(organization.joinCode).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(user.role).toBe("ORGANIZATION_ADMIN");
    expect(user.organizationId).toBe(organization.id);
    expect(user.isActive).toBe(true);
  });

  it("the returned accessToken actually authenticates as the new admin", async () => {
    const signupRes = await request(app).post("/api/auth/signup/organization").send(validPayload());

    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${signupRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe("owner@acme.example.com");
    expect(meRes.body.role).toBe("ORGANIZATION_ADMIN");
  });

  it("rejects a duplicate email", async () => {
    await createTestUser({ email: "owner@acme.example.com" });

    const res = await request(app).post("/api/auth/signup/organization").send(validPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app).post("/api/auth/signup/organization").send(validPayload({ email: "not-an-email" }));
    expect(res.status).toBe(422);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app).post("/api/auth/signup/organization").send(validPayload({ password: "short" }));
    expect(res.status).toBe(422);
  });

  it("rejects a missing organizationName", async () => {
    const res = await request(app)
      .post("/api/auth/signup/organization")
      .send({ email: "owner@acme.example.com", password: "Test1234!" });
    expect(res.status).toBe(422);
  });

  it("rejects an empty organizationName", async () => {
    const res = await request(app).post("/api/auth/signup/organization").send(validPayload({ organizationName: "" }));
    expect(res.status).toBe(422);
  });

  it("rejects an attempt to smuggle organizationId or role", async () => {
    const res = await request(app)
      .post("/api/auth/signup/organization")
      .send(validPayload({ organizationId: "00000000-0000-0000-0000-000000000000", role: "SUPER_ADMIN" }));
    expect(res.status).toBe(422);
  });

  it("never returns a password or passwordHash", async () => {
    const res = await request(app).post("/api/auth/signup/organization").send(validPayload());
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("does not require SUPER_ADMIN approval — the organization is usable immediately", async () => {
    const signupRes = await request(app).post("/api/auth/signup/organization").send(validPayload());
    const token = signupRes.body.accessToken as string;

    // Immediately manage the organization they just created — no approval
    // step, no extra login, no waiting.
    const res = await request(app)
      .get(`/api/organizations/${signupRes.body.user.organizationId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Acme Retail");
  });
});
