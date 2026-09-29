import type { Role } from "./auth";

// Mirrors backend/src/modules/managers/manager.service.ts's managerSelect
// exactly. Unlike Employee, Manager has NO `name` column at all (confirmed
// against prisma/schema.prisma directly) — and unlike Employee, `userId`
// is required, not nullable, so `user` is never null here. A manager's
// only identifying field is their login email; there is no separate
// "workforce name" to fall back to or invent.
export interface Manager {
  id: string;
  organizationId: string;
  storeId: string;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
}

// Mirrors createManagerSchema exactly. email/password are both always
// required here (never optional the way Employee's are) — every Manager
// is created together with its User account in one request.
export interface CreateManagerInput {
  email: string;
  password: string;
  storeId: string;
  joinedAt: string;
}

// Mirrors updateManagerSchema exactly — deliberately has no email/password.
// The backend has no credential-change endpoint for managers at all, so
// the mobile app doesn't invent one.
export interface UpdateManagerInput {
  storeId?: string;
  joinedAt?: string;
  isActive?: boolean;
}
