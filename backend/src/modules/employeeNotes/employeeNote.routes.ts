import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate";
import { requireRole } from "../../common/middleware/requireRole";
import { validate } from "../../common/middleware/validate";
import { Role } from "../../generated/prisma/enums";
import * as employeeNoteController from "./employeeNote.controller";
import { createEmployeeNoteSchema, listEmployeeNotesQuerySchema } from "./employeeNote.schemas";

const router = Router();

router.use(authenticate, requireRole(Role.ORGANIZATION_ADMIN, Role.STORE_MANAGER));

router.post("/", validate(createEmployeeNoteSchema), employeeNoteController.create);
router.get("/", validate(listEmployeeNotesQuerySchema, "query"), employeeNoteController.list);
router.get("/:noteId", employeeNoteController.getById);

// Append-only by design: no PATCH/PUT/DELETE route exists at all, not just
// a blocked one. Notes are immutable operational history.

export default router;
