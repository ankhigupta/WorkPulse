import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { Role } from "../../../generated/prisma/enums";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

const WEB_ORIGIN = "http://localhost:5173";
const REFRESH_COOKIE = "workpulse_refresh_token";

function cookieHeader(setCookie: string[] | undefined, name: string): string {
  const raw = (setCookie ?? []).find((cookie) => cookie.startsWith(`${name}=`));
  if (!raw) throw new Error(`cookie ${name} not present`);
  return raw.split(";")[0] as string;
}

function cookieValue(setCookie: string[] | undefined, name: string): string {
  return cookieHeader(setCookie, name).split("=")[1] as string;
}

function rawCookie(setCookie: string[] | undefined, name: string): string {
  const raw = (setCookie ?? []).find((cookie) => cookie.startsWith(`${name}=`));
  if (!raw) throw new Error(`cookie ${name} not present`);
  return raw;
}

async function webLogin(email: string, password: string) {
  return request(app)
    .post("/api/auth/login")
    .set("X-WorkPulse-Client", "web")
    .set("Origin", WEB_ORIGIN)
    .send({ email, password });
}

describe("web session cookies", () => {
  it("web login sets an httpOnly refresh cookie and omits the token from the body", async () => {
    const { user, password } = await createTestUser();

    const res = await webLogin(user.email, password);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.user.email).toBe(user.email);

    const cookie = rawCookie(res.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
    expect(cookie).toMatch(/SameSite/i);
  });

  it("mobile login is unchanged — token in the body, no cookie set", async () => {
    const { user, password } = await createTestUser();

    const res = await request(app).post("/api/auth/login").send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("web signup sets the cookie and omits the refresh token from the body", async () => {
    const res = await request(app)
      .post("/api/auth/signup/organization")
      .set("X-WorkPulse-Client", "web")
      .set("Origin", WEB_ORIGIN)
      .send({ organizationName: "Cookie Retail", email: "owner@cookie.test", password: "Test1234!" });

    expect(res.status).toBe(201);
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.user.role).toBe(Role.ORGANIZATION_ADMIN);
    expect(rawCookie(res.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE)).toMatch(/HttpOnly/i);
  });

  it("refresh works from the cookie alone, rotates it, and never returns the token in the body", async () => {
    const { user, password } = await createTestUser();
    const login = await webLogin(user.email, password);
    const original = cookieHeader(login.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", WEB_ORIGIN)
      .set("Cookie", original)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();

    const rotated = cookieValue(res.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);
    expect(rotated).not.toBe(original.split("=")[1]);
  });

  it("a rotated-away cookie cannot be reused", async () => {
    const { user, password } = await createTestUser();
    const login = await webLogin(user.email, password);
    const original = cookieHeader(login.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);

    await request(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN).set("Cookie", original).send({});
    const reuse = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", WEB_ORIGIN)
      .set("Cookie", original)
      .send({});

    expect(reuse.status).toBe(401);
  });

  it("refresh with neither cookie nor body token is a 401, not a validation error", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});

    expect(res.status).toBe(401);
  });

  it("web logout revokes the token server-side and clears the cookie", async () => {
    const { user, password } = await createTestUser();
    const login = await webLogin(user.email, password);
    const cookie = cookieHeader(login.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);

    const res = await request(app)
      .post("/api/auth/logout")
      .set("X-WorkPulse-Client", "web")
      .set("Origin", WEB_ORIGIN)
      .set("Cookie", cookie)
      .send({});

    expect(res.status).toBe(204);

    const cleared = rawCookie(res.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);
    expect(cleared).toMatch(/workpulse_refresh_token=;/);

    const reuse = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", WEB_ORIGIN)
      .set("Cookie", cookie)
      .send({});
    expect(reuse.status).toBe(401);

    const remaining = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(remaining).toBe(0);
  });
});

describe("CSRF origin validation", () => {
  it("rejects a cookie-authenticated refresh from a foreign origin", async () => {
    const { user, password } = await createTestUser();
    const login = await webLogin(user.email, password);
    const cookie = cookieHeader(login.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "https://evil.example")
      .set("Cookie", cookie)
      .send({});

    expect(res.status).toBe(403);
  });

  it("rejects a cookie-authenticated refresh with no Origin header at all", async () => {
    const { user, password } = await createTestUser();
    const login = await webLogin(user.email, password);
    const cookie = cookieHeader(login.headers["set-cookie"] as unknown as string[], REFRESH_COOKIE);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie).send({});

    expect(res.status).toBe(403);
  });

  it("rejects a web-client login from a foreign origin", async () => {
    const { user, password } = await createTestUser();

    const res = await request(app)
      .post("/api/auth/login")
      .set("X-WorkPulse-Client", "web")
      .set("Origin", "https://evil.example")
      .send({ email: user.email, password });

    expect(res.status).toBe(403);
  });

  it("does not require an Origin header for mobile (no cookie, no web header)", async () => {
    const { user, password } = await createTestUser();
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(200);
  });
});

describe("security headers and CORS", () => {
  it("sends Helmet's baseline security headers", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("allows the configured web origin with credentials", async () => {
    const res = await request(app).get("/health").set("Origin", WEB_ORIGIN);

    expect(res.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("never reflects a foreign origin, and never uses a wildcard with credentials", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("tenant isolation is untouched — org admin still cannot read another organization", async () => {
    const orgA = await createTestOrganization("Org A");
    const orgB = await createTestOrganization("Org B");
    const { user, password } = await createTestUser({
      role: Role.ORGANIZATION_ADMIN,
      organizationId: orgA.id,
    });
    const login = await webLogin(user.email, password);

    const res = await request(app)
      .get(`/api/organizations/${orgB.id}`)
      .set("Origin", WEB_ORIGIN)
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(404);
  });
});
