import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ApiError, type ApiErrorBody } from "../types/api";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

// withCredentials: the refresh token lives in an httpOnly cookie the
// browser attaches on its own. The header tells the backend to use
// cookie-based session handling for this client (mobile never sends it and
// keeps the original JSON-body contract).
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-WorkPulse-Client": "web",
  },
});

declare module "axios" {
  // Marks a request as already having gone through one 401-triggered
  // refresh-and-retry, so the interceptor below never loops.
  export interface InternalAxiosRequestConfig {
    _retried?: boolean;
  }
}

// Set by the auth store at creation. Kept as a registration hook rather
// than a direct import so this module doesn't depend on the store (which
// depends on this module for its own API calls).
let getAccessToken: () => string | null = () => null;
let onRefresh: () => Promise<string> = () => Promise.reject(new Error("No refresh handler registered"));
let onSessionLost: () => void = () => undefined;

export function registerAuthHandlers(handlers: {
  getAccessToken: () => string | null;
  refresh: () => Promise<string>;
  onSessionLost: () => void;
}): void {
  getAccessToken = handlers.getAccessToken;
  onRefresh = handlers.refresh;
  onSessionLost = handlers.onSessionLost;
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig | undefined;
    const isAuthEndpoint = original?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        refreshInFlight ??= onRefresh();
        const accessToken = await refreshInFlight;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return await apiClient(original);
      } catch {
        onSessionLost();
      } finally {
        refreshInFlight = null;
      }
    }

    const body = error.response?.data;
    if (body?.error) {
      throw new ApiError(error.response?.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(error.response?.status, "NETWORK_ERROR", error.message);
  },
);
