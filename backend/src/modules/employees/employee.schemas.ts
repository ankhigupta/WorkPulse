import { z } from "zod";

// name is the employee's real, human-readable identity — required,
// independent of any login account. email/password are optional and
// exist only to also provision a login account for this employee; when
// both are omitted, the Employee is created as a pure workforce record
// with no User at all. organizationId is deliberately never accepted —
// it always comes from req.auth. .strict() rejects any attempt to smuggle
// it (or any other unknown field) in as a 422, not a silent strip.
export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    storeId: z.string().uuid(),
    dailyWage: z.number().positive(),
    joinedAt: z.coerce.date(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
  })
  .strict()
  .refine((data) => (data.email === undefined) === (data.password === undefined), {
    message: "email and password must be provided together, or not at all",
    path: ["password"],
  });

export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    storeId: z.string().uuid().optional(),
    dailyWage: z.number().positive().optional(),
    joinedAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
