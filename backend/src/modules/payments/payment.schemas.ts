import { z } from "zod";

export const createPaymentSchema = z
  .object({
    employeeId: z.string().uuid(),
    // Plain z.number(), not z.coerce.number() — a numeric string like
    // "100" must be rejected outright, not silently coerced.
    amount: z.number().positive().finite().max(99999999.99).multipleOf(0.01),
    paidAt: z.coerce.date(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const dateOnly = z
  .string()
  .date()
  .transform((value) => new Date(value));

export const listPaymentsQuerySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
  })
  .strict();
