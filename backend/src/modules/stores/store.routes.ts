import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as storeController from "./store.controller";
import { createStoreSchema, updateStoreSchema } from "./store.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN));

router.post("/", validate(createStoreSchema), storeController.create);
router.get("/", storeController.list);
router.get("/:storeId", storeController.getById);
router.patch("/:storeId", validate(updateStoreSchema), storeController.update);

export default router;
