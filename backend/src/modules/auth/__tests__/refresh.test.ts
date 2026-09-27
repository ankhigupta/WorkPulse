import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function loginAndGetTokens(email: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return { accessToken: res.body.accessToken as string, refreshToken: res.body.refreshToken as string };
}

describe("POST /api/auth/refresh", () => {
  it("issues a new access token for a valid refresh token", async () => {
    const { user, password } = await createTestUser();
    const { refreshToken } = await loginAndGetTokens(user.email, password);

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rotates the refresh token — a new, different one is returned", async () => {
    const { user, password } = await createTestUser();
    const { refreshToken } = await loginAndGetTokens(user.email, password);

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("rejects reuse of the old refresh token after rotation", async () => {
    const { user, password } = await createTestUser();
    const { refreshToken } = await loginAndGetTokens(user.email, password);

    await request(app).post("/api/auth/refresh").send({ refreshToken });
    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(reuse.status).toBe(401);
  });

  it("rejects an expired refresh token", async () => {
    const { user } = await createTestUser();
    const rawToken = "expired-test-token-value";
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: rawToken });

    expect(res.status).toBe(401);
  });

  it("rejects a revoked refresh token", async () => {
    const { user } = await createTestUser();
    const rawToken = "revoked-test-token-value";
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: new Date(),
      },
    });

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: rawToken });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token", async () => {
    const { user, password } = await createTestUser();
    const { refreshToken } = await loginAndGetTokens(user.email, password);

    const logoutRes = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("is idempotent — logging out twice is safe", async () => {
    const { user, password } = await createTestUser();
    const { refreshToken } = await loginAndGetTokens(user.email, password);

    const first = await request(app).post("/api/auth/logout").send({ refreshToken });
    const second = await request(app).post("/api/auth/logout").send({ refreshToken });

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });
});
