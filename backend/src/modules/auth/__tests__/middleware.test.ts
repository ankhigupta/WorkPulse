import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../app";
import { authenticate } from "../../../common/middleware/authenticate";
import { requireRole } from "../../../common/middleware/requireRole";
import { UnauthorizedError, ForbiddenError } from "../../../common/errors";
import { env } from "../../../common/config/env";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

describe("authenticate middleware", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed Authorization header", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "NotBearer xyz");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid JWT", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer this-is-not-a-real-jwt");
    expect(res.status).toBe(401);
  });

  it("rejects an expired JWT", async () => {
    const org = await createTestOrganization();
    const { user } = await createTestUser({ organizationId: org.id });

    const expiredToken = jwt.sign(
      { sub: user.id, role: user.role, organizationId: user.organizationId },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it("populates req.auth correctly from a valid token", () => {
    const token = jwt.sign(
      { sub: "user-id-123", role: "EMPLOYEE", organizationId: "org-id-456" },
      env.JWT_ACCESS_SECRET,
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = vi.fn();

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toEqual({
      userId: "user-id-123",
      role: "EMPLOYEE",
      organizationId: "org-id-456",
    });
  });

  it("forwards an UnauthorizedError instance on failure", () => {
    const req = { headers: {} } as Request;
    const next = vi.fn();

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe("requireRole middleware", () => {
  it("allows an authorized role through", () => {
    const req = {
      auth: { userId: "u1", role: "ORGANIZATION_ADMIN", organizationId: "org1" },
    } as Request;
    const next = vi.fn();

    requireRole("ORGANIZATION_ADMIN")(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an unauthorized role with a ForbiddenError", () => {
    const req = {
      auth: { userId: "u1", role: "EMPLOYEE", organizationId: "org1" },
    } as Request;
    const next = vi.fn();

    requireRole("ORGANIZATION_ADMIN")(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
