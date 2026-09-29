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

// Same shape as loginRateLimiter, kept as its own instance (not reused)
// since it guards a semantically different public action — a clearer
// message, and a separate limit that can be tuned independently later.
// Applied to every public onboarding endpoint that either creates state
// or looks up an organization: signup, access-request creation, and the
// join-code lookup a would-be requester might probe before submitting.
export const publicOnboardingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
    },
  },
});
