import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../common/db/prisma";
import { env } from "../../common/config/env";
import { logger } from "../../common/logger";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../common/errors";
import { Prisma } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import { generateUniqueJoinCode } from "../organizations/organization.service";

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const REFRESH_TOKEN_BYTES = 64;

interface AccessTokenPayload {
  sub: string;
  role: Role;
  organizationId: string | null;
}

function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

// SHA-256, not bcrypt: refresh tokens must be looked up by exact value on
// every /refresh call. Bcrypt is one-way and salted per-call by design, so
// it can't support that lookup — it's for passwords, which are only ever
// *compared*, never searched for.
function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function buildRefreshTokenPayload(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  return { rawToken, tokenHash, expiresAt };
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: Role; organizationId: string | null };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      organizationId: true,
      isActive: true,
    },
  });

  // Same generic error whether the email doesn't exist, the account is
  // inactive, or the password is wrong — never reveal which one it was.
  if (!user || !user.isActive) {
    logger.warn({ email }, "Login failed");
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    logger.warn({ email }, "Login failed");
    throw new UnauthorizedError("Invalid email or password");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  const { rawToken, tokenHash, expiresAt } = buildRefreshTokenPayload();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  logger.info({ userId: user.id }, "Login succeeded");

  return {
    accessToken,
    refreshToken: rawToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

interface SignupOrganizationInput {
  organizationName: string;
  email: string;
  password: string;
}

// Public, unapproved self-signup — creates a brand-new Organization and
// its first ORGANIZATION_ADMIN together, atomically. No SUPER_ADMIN
// approval step exists or is needed: this is the "customer/business owner
// signs up directly" path from the onboarding model, distinct from
// STORE_MANAGER/EMPLOYEE self-signup (accessRequest.service.ts), which
// always requires an existing organization and an admin's approval.
export async function signupOrganization(data: SignupOrganizationInput): Promise<LoginResult> {
  const passwordHash = await bcrypt.hash(data.password, 12);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: data.organizationName, joinCode: await generateUniqueJoinCode(tx) },
      });

      return tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: Role.ORGANIZATION_ADMIN,
          organizationId: organization.id,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  const { rawToken, tokenHash, expiresAt } = buildRefreshTokenPayload();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  logger.info({ userId: user.id, organizationId: user.organizationId }, "Organization admin signup succeeded");

  return {
    accessToken,
    refreshToken: rawToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export async function refreshTokens(rawToken: string): Promise<RefreshResult> {
  const tokenHash = hashRefreshToken(rawToken);

  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true, role: true, organizationId: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const next = buildRefreshTokenPayload();

  // Revoke the old token and insert its replacement atomically — if the
  // insert failed after the revoke, the user would be locked out with no
  // valid refresh token at all.
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: next.tokenHash, expiresAt: next.expiresAt },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  return { accessToken, refreshToken: next.rawToken };
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);

  // updateMany + a where clause that only matches unrevoked tokens: no
  // error if the token is already gone or already revoked. Logout doesn't
  // leak whether a token existed.
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
  isActive: boolean;
  createdAt: Date;
}

export async function getCurrentUser(userId: string): Promise<CurrentUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}
