import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { createTestAccessRequest, createTestOrganization } from "../../../../tests/factories";

const validPayload = (organizationCode: string, overrides: Record<string, unknown> = {}) => ({
  organizationCode,
  email: "rohan@example.com",
  password: "Test1234!",
  name: "Rohan Mehta",
  requestedRole: "EMPLOYEE",
  ...overrides,
});

describe("POST /api/access-requests", () => {
  it("creates a valid EMPLOYEE request and returns a requestId + statusToken, nothing else sensitive", async () => {
    const org = await createTestOrganization();

    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode));

    expect(res.status).toBe(201);
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.body.statusToken).toEqual(expect.any(String));
    expect(Object.keys(res.body).sort()).toEqual(["requestId", "statusToken"]);

    const stored = await prisma.accessRequest.findUniqueOrThrow({ where: { id: res.body.requestId } });
    expect(stored.organizationId).toBe(org.id);
    expect(stored.email).toBe("rohan@example.com");
    expect(stored.requestedRole).toBe("EMPLOYEE");
    expect(stored.requestedName).toBe("Rohan Mehta");
    expect(stored.status).toBe("PENDING");
  });

  it("creates a valid STORE_MANAGER request", async () => {
    const org = await createTestOrganization();

    const res = await request(app)
      .post("/api/access-requests")
      .send(validPayload(org.joinCode, { requestedRole: "STORE_MANAGER" }));

    expect(res.status).toBe(201);
    const stored = await prisma.accessRequest.findUniqueOrThrow({ where: { id: res.body.requestId } });
    expect(stored.requestedRole).toBe("STORE_MANAGER");
  });

  it("does not create a User at any point during a request", async () => {
    const org = await createTestOrganization();
    const before = await prisma.user.count();

    await request(app).post("/api/access-requests").send(validPayload(org.joinCode));

    expect(await prisma.user.count()).toBe(before);
  });

  it("stores the password as a bcrypt hash, never plaintext, and never returns it", async () => {
    const org = await createTestOrganization();

    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode));

    const stored = await prisma.accessRequest.findUniqueOrThrow({ where: { id: res.body.requestId } });
    expect(stored.passwordHash).not.toBe("Test1234!");
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it.each(["ORGANIZATION_ADMIN", "SUPER_ADMIN"])("rejects requestedRole=%s outright", async (role) => {
    const org = await createTestOrganization();
    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode, { requestedRole: role }));
    expect(res.status).toBe(422);
  });

  it("rejects an arbitrary/unknown requestedRole", async () => {
    const org = await createTestOrganization();
    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode, { requestedRole: "MANAGER" }));
    expect(res.status).toBe(422);
  });

  it("rejects an invalid join code with a generic not-found, not a validation error", async () => {
    const res = await request(app).post("/api/access-requests").send(validPayload("NOT-A-REAL-CODE"));
    expect(res.status).toBe(404);
  });

  it("rejects a request against an inactive organization, identically to an invalid code", async () => {
    const org = await createTestOrganization();
    await prisma.organization.update({ where: { id: org.id }, data: { isActive: false } });

    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode));
    expect(res.status).toBe(404);
  });

  it("rejects a missing name", async () => {
    const org = await createTestOrganization();
    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode, { name: "" }));
    expect(res.status).toBe(422);
  });

  it("rejects an invalid email", async () => {
    const org = await createTestOrganization();
    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode, { email: "not-an-email" }));
    expect(res.status).toBe(422);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const org = await createTestOrganization();
    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode, { password: "short" }));
    expect(res.status).toBe(422);
  });

  it("rejects an attempt to smuggle organizationId directly", async () => {
    const org = await createTestOrganization();
    const res = await request(app)
      .post("/api/access-requests")
      .send(validPayload(org.joinCode, { organizationId: org.id }));
    expect(res.status).toBe(422);
  });

  it("normalizes email by trimming whitespace, consistent with existing auth behavior (no case-folding)", async () => {
    const org = await createTestOrganization();

    const res = await request(app)
      .post("/api/access-requests")
      .send(validPayload(org.joinCode, { email: "  rohan@example.com  " }));

    expect(res.status).toBe(201);
    const stored = await prisma.accessRequest.findUniqueOrThrow({ where: { id: res.body.requestId } });
    expect(stored.email).toBe("rohan@example.com");
  });

  it("rejects a duplicate PENDING request for the same email + organization", async () => {
    const org = await createTestOrganization();
    await createTestAccessRequest({ organizationId: org.id, email: "rohan@example.com" });

    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode));

    expect(res.status).toBe(409);
  });

  it("allows a new request once the prior one for that email+org was APPROVED", async () => {
    const org = await createTestOrganization();
    await createTestAccessRequest({ organizationId: org.id, email: "rohan@example.com", status: "APPROVED" });

    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode));

    expect(res.status).toBe(201);
  });

  it("allows a new request once the prior one for that email+org was REJECTED", async () => {
    const org = await createTestOrganization();
    await createTestAccessRequest({ organizationId: org.id, email: "rohan@example.com", status: "REJECTED" });

    const res = await request(app).post("/api/access-requests").send(validPayload(org.joinCode));

    expect(res.status).toBe(201);
  });

  it("the same email may have simultaneous PENDING requests at two different organizations", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");

    const resA = await request(app).post("/api/access-requests").send(validPayload(orgA.joinCode));
    const resB = await request(app).post("/api/access-requests").send(validPayload(orgB.joinCode));

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
  });

  it("concurrent duplicate submissions for the same email+org: exactly one succeeds", async () => {
    const org = await createTestOrganization();

    const [first, second] = await Promise.all([
      request(app).post("/api/access-requests").send(validPayload(org.joinCode)),
      request(app).post("/api/access-requests").send(validPayload(org.joinCode)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.accessRequest.count({ where: { organizationId: org.id, status: "PENDING" } });
    expect(count).toBe(1);
  });
});
