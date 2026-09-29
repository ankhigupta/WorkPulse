import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../constants/config";
import { ApiError, type ApiErrorBody } from "../types/api";
import { useAuthStore } from "../stores/authStore";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

declare module "axios" {
  // Marks a request as already having gone through one 401-triggered
  // refresh-and-retry, so the interceptor below never loops.
  export interface InternalAxiosRequestConfig {
    _retried?: boolean;
  }
}

let refreshInFlight: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig | undefined;
    const isAuthEndpoint = original?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        refreshInFlight ??= useAuthStore.getState().refresh();
        const accessToken = await refreshInFlight;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch {
        await useAuthStore.getState().logout();
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
