import { z } from "zod";

// email/password create the employee's User account directly (admin sets
// the initial password). organizationId is deliberately never accepted —
// it always comes from req.auth. .strict() rejects any attempt to smuggle
// it (or any other unknown field) in as a 422, not a silent strip.
export const createEmployeeSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    storeId: z.string().uuid(),
    dailyWage: z.number().positive(),
    joinedAt: z.coerce.date(),
  })
  .strict();

export const updateEmployeeSchema = z
  .object({
    storeId: z.string().uuid().optional(),
    dailyWage: z.number().positive().optional(),
    joinedAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
