import dotenv from "dotenv";
import { z } from "zod";

// Loading environment variables
dotenv.config();

// Defining the expected environment variables
const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  // Exact browser origins allowed to call this API with credentials.
  // Comma-separated, never a wildcard: CORS forbids `*` together with
  // `credentials: true`, and the refresh cookie depends on credentials.
  WEB_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // Cookie attributes depend on deployment topology, so they're config,
  // not constants. Secure must be true anywhere the site is served over
  // HTTPS; SameSite must be "none" only when the web app and API are on
  // genuinely different sites (different registrable domains), which also
  // forces Secure. Origin validation (verifyWebOrigin) is the CSRF defense
  // that holds regardless of which combination is configured.
  REFRESH_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  REFRESH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  REFRESH_COOKIE_DOMAIN: z.string().optional(),

  // Consumed only by scripts/bootstrapSuperAdmin.ts — never read by the
  // running server, and never wired into any request path. Optional here
  // because most environments (including every test run) never set them;
  // the bootstrap script itself is what requires their presence.
  SUPER_ADMIN_EMAIL: z.string().trim().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

// Validating the environment
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables");
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;