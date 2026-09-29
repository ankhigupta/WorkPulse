import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { validate } from "../../common/middleware/validate";
import { verifyWebOrigin } from "../../common/middleware/verifyWebOrigin";
import * as authController from "./auth.controller";
import { loginSchema, logoutSchema, refreshSchema, signupOrganizationSchema } from "./auth.schemas";
import { loginRateLimiter, publicOnboardingRateLimiter } from "./rateLimiter";

const router = Router();

// verifyWebOrigin only engages for requests carrying a browser credential
// (the web client header or the refresh cookie) — it is a no-op for mobile,
// which authenticates with body/bearer tokens that can't be sent ambiently
// by a cross-site page.
router.post(
  "/signup/organization",
  publicOnboardingRateLimiter,
  verifyWebOrigin,
  validate(signupOrganizationSchema),
  authController.signupOrganization,
);
router.post("/login", loginRateLimiter, verifyWebOrigin, validate(loginSchema), authController.login);
router.post("/refresh", verifyWebOrigin, validate(refreshSchema), authController.refresh);
router.post("/logout", verifyWebOrigin, validate(logoutSchema), authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
