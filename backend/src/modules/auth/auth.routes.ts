import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { validate } from "../../common/middleware/validate";
import * as authController from "./auth.controller";
import { loginSchema, logoutSchema, refreshSchema } from "./auth.schemas";
import { loginRateLimiter } from "./rateLimiter";

const router = Router();

router.post("/login", loginRateLimiter, validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(logoutSchema), authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
