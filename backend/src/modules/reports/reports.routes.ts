import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as reportsController from "./reports.controller";
import {
  attendanceReportQuerySchema,
  paymentsReportQuerySchema,
  payrollReportQuerySchema,
  workforceReportQuerySchema,
} from "./reports.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER));

router.get("/attendance", validate(attendanceReportQuerySchema, "query"), reportsController.attendance);
router.get("/payroll", validate(payrollReportQuerySchema, "query"), reportsController.payroll);
router.get("/payments", validate(paymentsReportQuerySchema, "query"), reportsController.payments);
router.get("/workforce", validate(workforceReportQuerySchema, "query"), reportsController.workforce);

export default router;
