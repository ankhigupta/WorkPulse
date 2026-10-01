import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as attendanceController from "./attendance.controller";
import {
  createAttendanceSchema,
  listAttendanceQuerySchema,
  updateAttendanceAsOrgAdminSchema,
  updateAttendanceAsStoreManagerSchema,
} from "./attendance.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER));

// ORGANIZATION_ADMIN gets the wider schema (status editable); STORE_MANAGER
// gets the narrower one (method only). Picked per-request since it depends
// on req.auth, which only exists after `authenticate` has run — same
// pattern as organization.routes.ts's validateOrganizationUpdate.
function validateAttendanceUpdate(req: Request, res: Response, next: NextFunction): void {
  const schema =
    req.auth?.role === Role.ORGANIZATION_ADMIN
      ? updateAttendanceAsOrgAdminSchema
      : updateAttendanceAsStoreManagerSchema;

  validate(schema)(req, res, next);
}

router.post("/", validate(createAttendanceSchema), attendanceController.create);
router.get("/", validate(listAttendanceQuerySchema, "query"), attendanceController.list);
router.get("/:attendanceId", attendanceController.getById);
router.patch("/:attendanceId", validateAttendanceUpdate, attendanceController.update);

export default router;
