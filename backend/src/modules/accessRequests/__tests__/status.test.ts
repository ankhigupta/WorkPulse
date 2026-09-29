import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { createTestAccessRequest, createTestOrganization } from "../../../../tests/factories";

describe("GET /api/access-requests/:requestId/status", () => {
  it("returns status + organizationName given the correct requestId and statusToken", async () => {
    const org = await createTestOrganization("Acme Retail");
    const { request: accessRequest, statusToken } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: statusToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "PENDING", organizationName: "Acme Retail" });
  });

  it("reflects APPROVED status", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest, statusToken } = await createTestAccessRequest({ organizationId: org.id, status: "APPROVED" });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: statusToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("reflects REJECTED status", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest, statusToken } = await createTestAccessRequest({ organizationId: org.id, status: "REJECTED" });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: statusToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
  });

  it("returns 404 for the correct requestId with the wrong token", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: "wrong-token" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent requestId, even with a well-formed token", async () => {
    const res = await request(app)
      .get("/api/access-requests/00000000-0000-0000-0000-000000000000/status")
      .query({ token: "a".repeat(64) });

    expect(res.status).toBe(404);
  });

  it("does not allow lookup by email alone — there is no such parameter", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest } = await createTestAccessRequest({ organizationId: org.id, email: "rohan@example.com" });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ email: "rohan@example.com" });

    // No token supplied at all -> validation failure, not a lookup.
    expect(res.status).toBe(422);
  });

  it("never returns passwordHash, statusTokenHash, email, or rejectionReason", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest, statusToken } = await createTestAccessRequest({
      organizationId: org.id,
      status: "REJECTED",
    });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: statusToken });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["organizationName", "status"]);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("does not require authentication", async () => {
    const org = await createTestOrganization();
    const { request: accessRequest, statusToken } = await createTestAccessRequest({ organizationId: org.id });

    const res = await request(app).get(`/api/access-requests/${accessRequest.id}/status`).query({ token: statusToken });

    expect(res.status).toBe(200);
  });
});
