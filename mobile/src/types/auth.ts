// Mirrors backend/src/generated/prisma/enums.ts Role — kept as a literal union
// here rather than importing across the workspace boundary.
export type Role = "SUPER_ADMIN" | "ORGANIZATION_ADMIN" | "STORE_MANAGER" | "EMPLOYEE";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated";

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
