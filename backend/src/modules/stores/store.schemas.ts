import { z } from "zod";

// organizationId is deliberately absent — it is never accepted from the
// client. `.strict()` means a client attempting to supply it (or any other
// unknown field) gets a 422, not a silent strip.
export const createStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    address: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    address: z.string().trim().max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
