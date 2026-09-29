import { create } from "zustand";
import * as authApi from "../api/auth";
import { registerAuthHandlers } from "../api/client";
import type { AuthUser, Role } from "../types/domain";

export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "roleNotSupported";

/** The only two roles the web application serves. Backend RBAC is the real
 *  boundary — this gate exists so the other roles get a clear explanation
 *  instead of a wall of 403s on every screen. */
const WEB_ROLES: Role[] = ["SUPER_ADMIN", "ORGANIZATION_ADMIN"];

export function isWebRole(role: Role): boolean {
  return WEB_ROLES.includes(role);
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  /** Restores a session from the httpOnly refresh cookie on app start. */
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signupOrganization: (organizationName: string, email: string, password: string) => Promise<void>;
  refresh: () => Promise<string>;
  logout: () => Promise<void>;
  /** Clears local state without calling the API — used when a refresh fails. */
  clearSession: () => void;
}

// Nothing is persisted by this store. The access token is memory-only and
// dies with the tab; the refresh token is an httpOnly cookie JavaScript
// cannot read, so there is deliberately no localStorage/sessionStorage
// path here at all.
export const useAuthStore = create<AuthState>((set) => ({
  status: "bootstrapping",
  user: null,
  accessToken: null,

  bootstrap: async () => {
    try {
      const { accessToken } = await authApi.refreshSession();
      set({ accessToken });
      const user = await authApi.getCurrentUser();
      applySession(set, user, accessToken);
    } catch {
      set({ status: "unauthenticated", user: null, accessToken: null });
    }
  },

  login: async (email, password) => {
    const { accessToken, user } = await authApi.login(email, password);
    set({ accessToken });
    applySession(set, user, accessToken);
  },

  signupOrganization: async (organizationName, email, password) => {
    const { accessToken, user } = await authApi.signupOrganization(organizationName, email, password);
    set({ accessToken });
    applySession(set, user, accessToken);
  },

  refresh: async () => {
    const { accessToken } = await authApi.refreshSession();
    set({ accessToken });
    return accessToken;
  },

  logout: async () => {
    set({ status: "unauthenticated", user: null, accessToken: null });
    // Best-effort: the local session is already gone either way, and an
    // unreachable API shouldn't trap the user in a logged-in UI.
    await authApi.logout().catch(() => undefined);
  },

  clearSession: () => set({ status: "unauthenticated", user: null, accessToken: null }),
}));

// A STORE_MANAGER/EMPLOYEE can legitimately authenticate against the
// backend (login has no role restriction, by design, because mobile uses
// it). The web client refuses to build a session for them: local state is
// cleared, the server-side refresh token is revoked, and the UI explains
// that their role belongs on mobile.
function applySession(
  set: (partial: Partial<AuthState>) => void,
  user: AuthUser,
  _accessToken: string,
): void {
  if (!isWebRole(user.role)) {
    set({ status: "roleNotSupported", user: null, accessToken: null });
    void authApi.logout().catch(() => undefined);
    return;
  }

  set({ user, status: "authenticated" });
}

registerAuthHandlers({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refresh: () => useAuthStore.getState().refresh(),
  onSessionLost: () => useAuthStore.getState().clearSession(),
});
