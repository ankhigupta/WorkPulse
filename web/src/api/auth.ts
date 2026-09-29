import { apiClient } from "./client";
import type { CurrentUser, WebSessionResponse } from "../types/domain";

export async function login(email: string, password: string): Promise<WebSessionResponse> {
  const { data } = await apiClient.post<WebSessionResponse>("/auth/login", { email, password });
  return data;
}

export async function signupOrganization(
  organizationName: string,
  email: string,
  password: string,
): Promise<WebSessionResponse> {
  const { data } = await apiClient.post<WebSessionResponse>("/auth/signup/organization", {
    organizationName,
    email,
    password,
  });
  return data;
}

// No body at all — the refresh token travels as the httpOnly cookie, and
// the response carries only a new access token.
export async function refreshSession(): Promise<{ accessToken: string }> {
  const { data } = await apiClient.post<{ accessToken: string }>("/auth/refresh", {});
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout", {});
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const { data } = await apiClient.get<CurrentUser>("/auth/me");
  return data;
}
