import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as payrollController from "./payroll.controller";
import { createPayrollSchema, listPayrollQuerySchema } from "./payroll.schemas";

const router = Router();

// ORGANIZATION_ADMIN only — payroll is financially sensitive, and nothing
// in the product's role model grants STORE_MANAGER wage/financial
// visibility (PROJECT.md's "Today's Wage Liability" dashboard widget is
// Organization Admin only).
router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN));

router.post("/", validate(createPayrollSchema), payrollController.create);
router.get("/", validate(listPayrollQuerySchema, "query"), payrollController.list);
router.get("/:payrollId", payrollController.getById);
router.post("/:payrollId/recalculate", payrollController.recalculate);
router.post("/:payrollId/finalize", payrollController.finalize);

export default router;
