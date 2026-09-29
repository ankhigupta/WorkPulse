import { apiClient } from "./client";
import type { AuthUser, LoginResponse, RefreshResponse } from "../types/auth";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", { email, password });
  return data;
}

// Same response shape as login (accessToken/refreshToken/user) — creates
// the Organization + first ORGANIZATION_ADMIN atomically and logs them
// straight in, no approval step.
export async function signupOrganization(organizationName: string, email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/signup/organization", { organizationName, email, password });
  return data;
}

export async function refreshTokens(refreshToken: string): Promise<RefreshResponse> {
  const { data } = await apiClient.post<RefreshResponse>("/auth/refresh", { refreshToken });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refreshToken });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/auth/me");
  return data;
}
