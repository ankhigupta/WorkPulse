import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { publicOnboardingRateLimiter } from "../auth/rateLimiter";
import { Role } from "../../generated/prisma/enums";
import * as accessRequestController from "./accessRequest.controller";
import {
  approveAccessRequestSchema,
  accessRequestStatusQuerySchema,
  createAccessRequestSchema,
  listAccessRequestsQuerySchema,
  rejectAccessRequestSchema,
} from "./accessRequest.schemas";

const router = Router();

// Public — no account exists yet for the requester at any point before
// approval, so none of these three can be behind `authenticate`.
router.post(
  "/",
  publicOnboardingRateLimiter,
  validate(createAccessRequestSchema),
  accessRequestController.create,
);
router.get(
  "/:requestId/status",
  publicOnboardingRateLimiter,
  validate(accessRequestStatusQuerySchema, "query"),
  accessRequestController.status,
);

// ORGANIZATION_ADMIN only — approving/rejecting is the one place a new
// User/Employee/Manager actually gets created from a request, and only an
// org admin has that authority (mirrors employee.routes.ts/manager.routes.ts's
// POST gating exactly).
router.get(
  "/",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN),
  validate(listAccessRequestsQuerySchema, "query"),
  accessRequestController.list,
);
router.post(
  "/:requestId/approve",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN),
  validate(approveAccessRequestSchema),
  accessRequestController.approve,
);
router.post(
  "/:requestId/reject",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN),
  validate(rejectAccessRequestSchema),
  accessRequestController.reject,
);

export default router;
