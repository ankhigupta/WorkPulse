import type { Role } from "../generated/prisma/enums";

export interface AuthContext {
  userId: string;
  role: Role;
  organizationId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      // Populated by the `validate(schema, "query")` middleware. Untyped
      // here (route-specific) — controllers cast to the shape their own
      // query schema produces.
      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
