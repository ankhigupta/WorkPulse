import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../components/Toast";
import { useAuthStore } from "../stores/authStore";
import type { AuthUser, Role } from "../types/domain";

export function renderWithProviders(ui: ReactNode, { route = "/" }: { route?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

export function signInAs(role: Role, overrides: Partial<AuthUser> = {}) {
  useAuthStore.setState({
    status: "authenticated",
    accessToken: "test-access-token",
    user: {
      id: "user-1",
      email: "admin@example.com",
      role,
      organizationId: role === "SUPER_ADMIN" ? null : "org-1",
      ...overrides,
    },
  });
}

export function signOut() {
  useAuthStore.setState({ status: "unauthenticated", user: null, accessToken: null });
}

export function setAuthStatus(status: "bootstrapping" | "unauthenticated" | "roleNotSupported") {
  useAuthStore.setState({ status, user: null, accessToken: null });
}
