import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as organizationController from "./organization.controller";
import {
  createOrganizationSchema,
  updateOrganizationAsOrgAdminSchema,
  updateOrganizationAsSuperAdminSchema,
} from "./organization.schemas";

const router = Router();

// SUPER_ADMIN sees the full update schema (can also toggle isActive);
// ORGANIZATION_ADMIN gets the narrower one. Picked per-request since it
// depends on req.auth, which only exists after `authenticate` has run.
function validateOrganizationUpdate(req: Request, res: Response, next: NextFunction): void {
  const schema =
    req.auth?.role === Role.SUPER_ADMIN
      ? updateOrganizationAsSuperAdminSchema
      : updateOrganizationAsOrgAdminSchema;

  validate(schema)(req, res, next);
}

router.post(
  "/",
  authenticate,
  requireRole(Role.SUPER_ADMIN),
  validate(createOrganizationSchema),
  organizationController.create,
);

router.get("/", authenticate, requireRole(Role.SUPER_ADMIN), organizationController.list);

router.get(
  "/:organizationId",
  authenticate,
  requireRole(Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN),
  organizationController.getById,
);

router.patch(
  "/:organizationId",
  authenticate,
  requireRole(Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN),
  validateOrganizationUpdate,
  organizationController.update,
);

export default router;
