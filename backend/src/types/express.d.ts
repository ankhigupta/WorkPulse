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
    }
  }
}

export {};
