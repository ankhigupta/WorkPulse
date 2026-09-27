import rateLimit from "express-rate-limit";
import { env } from "../../common/config/env";

// Basic brute-force guard on login. Advanced hardening (per-account
// backoff, CAPTCHA, IP reputation) is deferred to a later security pass.
//
// Skipped entirely in the test environment: the in-memory limit store is
// keyed by IP and shared across the whole process, so an integration
// suite that legitimately logs in dozens of times per file would trip it
// well before exercising real scenarios. This only ever evaluates true
// when NODE_ENV=test, so production behavior is unaffected.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Please try again later.",
    },
  },
});
