import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as paymentController from "./payment.controller";
import { createPaymentSchema, listPaymentsQuerySchema } from "./payment.schemas";

const router = Router();

// ORGANIZATION_ADMIN only — payment information is financially sensitive.
// PROJECT.md assigns "Record employee payments" to Organization Admin
// specifically; nothing grants STORE_MANAGER or EMPLOYEE financial access,
// consistent with the same reasoning already applied to Payroll.
router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN));

router.post("/", validate(createPaymentSchema), paymentController.create);
router.get("/", validate(listPaymentsQuerySchema, "query"), paymentController.list);
router.get("/balance/:employeeId", paymentController.getBalance);
router.get("/:paymentId", paymentController.getById);

// Append-only by design: no PATCH/PUT/DELETE route exists at all. No
// correction/reversal workflow is defined anywhere in the existing
// project requirements, so payment records stay immutable history.

export default router;
