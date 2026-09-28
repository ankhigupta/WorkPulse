import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as dashboardController from "./dashboard.controller";
import { dashboardSummaryQuerySchema } from "./dashboard.schemas";

const router = Router();

router.get(
  "/summary",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER),
  validate(dashboardSummaryQuerySchema, "query"),
  dashboardController.getSummary,
);

export default router;
