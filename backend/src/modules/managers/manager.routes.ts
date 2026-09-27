import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as managerController from "./manager.controller";
import { createManagerSchema, updateManagerSchema } from "./manager.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN));

router.post("/", validate(createManagerSchema), managerController.create);
router.get("/", managerController.list);
router.get("/:managerId", managerController.getById);
router.patch("/:managerId", validate(updateManagerSchema), managerController.update);

export default router;
