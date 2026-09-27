import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as employeeController from "./employee.controller";
import { createEmployeeSchema, updateEmployeeSchema } from "./employee.schemas";

const router = Router();

router.post(
  "/",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN),
  validate(createEmployeeSchema),
  employeeController.create,
);

router.get(
  "/",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER),
  employeeController.list,
);

router.get(
  "/:employeeId",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER),
  employeeController.getById,
);

router.patch(
  "/:employeeId",
  authenticate,
  requireRole(Role.ORGANIZATION_ADMIN),
  validate(updateEmployeeSchema),
  employeeController.update,
);

export default router;
