import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

describe("POST /api/auth/login", () => {
  it("returns 200 with accessToken, refreshToken, and user for correct credentials", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ organizationId: org.id });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: org.id,
    });
  });

  it("never returns passwordHash", async () => {
    const { user, password } = await createTestUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });

    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("returns a generic 401 for the wrong password", async () => {
    const { user } = await createTestUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("returns the same generic 401 for a nonexistent email, never revealing whether the account exists", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("returns the same generic 401 for an inactive user", async () => {
    const { user, password } = await createTestUser({ isActive: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("returns a validation error for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "x" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a validation error for a missing password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "someone@example.com" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
