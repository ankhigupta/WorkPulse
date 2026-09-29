import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as authApi from "../api/auth";
import type { AuthStatus, AuthUser } from "../types/auth";

const REFRESH_TOKEN_KEY = "workpulse.refreshToken";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  /** Reads the persisted refresh token and hydrates a session on app start. */
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signupOrganization: (organizationName: string, email: string, password: string) => Promise<void>;
  /** Exchanges the stored refresh token for a new access token; returns it. */
  refresh: () => Promise<string>;
  logout: () => Promise<void>;
}

// Only the refresh token is persisted, and only in SecureStore (Keychain/
// Keystore-backed) — never in AsyncStorage or a zustand `persist` middleware,
// since either would land it in plain storage. The access token and user
// live in memory only and are rebuilt from the refresh token on cold start.
export const useAuthStore = create<AuthState>((set, get) => ({
  status: "bootstrapping",
  user: null,
  accessToken: null,

  bootstrap: async () => {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      set({ status: "unauthenticated" });
      return;
    }

    try {
      const { accessToken, refreshToken } = await authApi.refreshTokens(storedRefreshToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      set({ accessToken });
      const user = await authApi.getCurrentUser();
      set({ user, status: "authenticated" });
    } catch {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      set({ status: "unauthenticated", user: null, accessToken: null });
    }
  },

  login: async (email, password) => {
    const { accessToken, refreshToken, user } = await authApi.login(email, password);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, user, status: "authenticated" });
  },

  // Same session-establishment shape as login — the backend returns an
  // identical {accessToken, refreshToken, user} envelope, so this doesn't
  // introduce a second kind of authenticated state.
  signupOrganization: async (organizationName, email, password) => {
    const { accessToken, refreshToken, user } = await authApi.signupOrganization(organizationName, email, password);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, user, status: "authenticated" });
  },

  refresh: async () => {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      throw new Error("No refresh token available");
    }
    const { accessToken, refreshToken } = await authApi.refreshTokens(storedRefreshToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken });
    return accessToken;
  },

  logout: async () => {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ status: "unauthenticated", user: null, accessToken: null });
    if (storedRefreshToken) {
      // Best-effort — the local session is already cleared either way, and
      // an unreachable API shouldn't trap the user in a logged-in UI.
      await authApi.logout(storedRefreshToken).catch(() => undefined);
    }
  },
}));
