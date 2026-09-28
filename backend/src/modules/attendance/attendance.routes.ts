import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as attendanceController from "./attendance.controller";
import {
  createAttendanceSchema,
  listAttendanceQuerySchema,
  updateAttendanceSchema,
} from "./attendance.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER));

router.post("/", validate(createAttendanceSchema), attendanceController.create);
router.get("/", validate(listAttendanceQuerySchema, "query"), attendanceController.list);
router.get("/:attendanceId", attendanceController.getById);
router.patch("/:attendanceId", validate(updateAttendanceSchema), attendanceController.update);

export default router;
