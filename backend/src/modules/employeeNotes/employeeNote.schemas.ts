import { z } from "zod";

// 2000 chars is generous for an operational note (onboarding/administrative
// remarks) while still bounding it — this is an append-only, forever-kept
// record, not a place for arbitrarily large free text.
const MAX_NOTE_LENGTH = 2000;

export const createEmployeeNoteSchema = z
  .object({
    employeeId: z.string().uuid(),
    body: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  })
  .strict();

export const listEmployeeNotesQuerySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
  })
  .strict();
