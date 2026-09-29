import { z } from "zod";

// Same UTC-safe date-only pattern established in Attendance/Payroll/
// AttendanceCorrections — joinedAt at approval time uses the full
// z.coerce.date() form (matching createEmployeeSchema/createManagerSchema
// exactly, not the stricter date-only variant those two don't use either).

// requestedRole is structurally restricted to EMPLOYEE/STORE_MANAGER —
// ORGANIZATION_ADMIN/SUPER_ADMIN are not valid enum members here, so a
// request for either is a 422 before any service code runs at all.
export const createAccessRequestSchema = z
  .object({
    organizationCode: z.string().trim().min(1).max(32),
    email: z.string().trim().email(),
    password: z.string().min(8),
    name: z.string().trim().min(1).max(255),
    requestedRole: z.enum(["EMPLOYEE", "STORE_MANAGER"]),
  })
  .strict();

export const accessRequestStatusQuerySchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();

export const listAccessRequestsQuerySchema = z
  .object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  })
  .strict();

// A discriminated union on `role`, not a single object with an optional
// `dailyWage` — this makes "STORE_MANAGER approval carries a dailyWage"
// impossible to even submit (.strict() rejects the unrecognized key),
// not just something the service layer happens to ignore. The admin's
// `role` choice here is what actually gets written to the new User —
// requestedRole on the stored AccessRequest is never trusted directly.
export const approveAccessRequestSchema = z.discriminatedUnion("role", [
  z
    .object({
      role: z.literal("EMPLOYEE"),
      storeId: z.string().uuid(),
      joinedAt: z.coerce.date(),
      // Optional override of the requester's own stated name — falls back
      // to AccessRequest.requestedName when omitted, never to email.
      name: z.string().trim().min(1).max(255).optional(),
      dailyWage: z.number().positive(),
    })
    .strict(),
  z
    .object({
      role: z.literal("STORE_MANAGER"),
      storeId: z.string().uuid(),
      joinedAt: z.coerce.date(),
    })
    .strict(),
]);

export const rejectAccessRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
