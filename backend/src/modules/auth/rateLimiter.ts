import rateLimit from "express-rate-limit";

// Basic brute-force guard on login. Advanced hardening (per-account
// backoff, CAPTCHA, IP reputation) is deferred to a later security pass.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Please try again later.",
    },
  },
});
