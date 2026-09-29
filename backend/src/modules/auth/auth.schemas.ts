import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Optional because a web session carries its refresh token in an httpOnly
// cookie and sends no body at all. The controller resolves cookie-then-body
// and raises a 401 when neither is present, so a missing token is still
// rejected — just as an auth failure rather than a validation error.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

// Same password-length convention already used by Employee/Manager
// creation (z.string().min(8)) — no additional complexity rule invented
// for this endpoint that doesn't already exist elsewhere.
export const signupOrganizationSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(255),
    email: z.string().trim().email(),
    password: z.string().min(8),
  })
  .strict();
