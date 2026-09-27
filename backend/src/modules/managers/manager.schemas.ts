import { z } from "zod";

export const createManagerSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    storeId: z.string().uuid(),
    joinedAt: z.coerce.date(),
  })
  .strict();

export const updateManagerSchema = z
  .object({
    storeId: z.string().uuid().optional(),
    joinedAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
