import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as correctionController from "./attendanceCorrection.controller";
import { createCorrectionSchema, listCorrectionsQuerySchema } from "./attendanceCorrection.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER));

router.post("/", validate(createCorrectionSchema), correctionController.create);
router.get("/", validate(listCorrectionsQuerySchema, "query"), correctionController.list);
router.get("/:correctionId", correctionController.getById);

// Approval/rejection are an ORGANIZATION_ADMIN-only responsibility — layered
// on top of the router-level role gate above, which still allows
// STORE_MANAGER through for the routes above this point.
router.post(
  "/:correctionId/approve",
  requireRole(Role.ORGANIZATION_ADMIN),
  correctionController.approve,
);
router.post(
  "/:correctionId/reject",
  requireRole(Role.ORGANIZATION_ADMIN),
  correctionController.reject,
);

export default router;
