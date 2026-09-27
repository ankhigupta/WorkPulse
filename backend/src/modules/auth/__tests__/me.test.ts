import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { prisma } from "../../../common/db/prisma";
import { createTestOrganization, createTestUser } from "../../../../tests/factories";

async function loginAndGetToken(email: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ organizationId: org.id });
    const accessToken = await loginAndGetToken(user.email, password);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: org.id,
      isActive: true,
    });
  });

  it("never exposes passwordHash", async () => {
    const { user, password } = await createTestUser();
    const accessToken = await loginAndGetToken(user.email, password);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("reflects current database state rather than stale JWT claims", async () => {
    const org = await createTestOrganization();
    const { user, password } = await createTestUser({ organizationId: org.id, isActive: true });
    const accessToken = await loginAndGetToken(user.email, password);

    // The access token was signed while isActive was true. Change it in the
    // DB afterward — the still-valid, unexpired token keeps authenticating
    // (that's the stateless-JWT trade-off), but /me's own DB read must show
    // the current value, not what was true when the token was issued.
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });
});
