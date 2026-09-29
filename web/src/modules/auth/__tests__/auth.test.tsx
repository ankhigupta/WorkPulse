import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../LoginPage";
import { OrgSignupPage } from "../OrgSignupPage";
import { useAuthStore } from "../../../stores/authStore";
import { ApiError } from "../../../types/api";
import { renderWithProviders, setAuthStatus } from "../../../test/utils";

const login = vi.fn();
const signupOrganization = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);
const getCurrentUser = vi.fn();
const refreshSession = vi.fn();

vi.mock("../../../api/auth", () => ({
  login: (...args: unknown[]) => login(...args),
  signupOrganization: (...args: unknown[]) => signupOrganization(...args),
  logout: () => logout(),
  getCurrentUser: () => getCurrentUser(),
  refreshSession: () => refreshSession(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    setAuthStatus("unauthenticated");
  });

  it("validates before calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/work email is required/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects a malformed email without calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/work email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs an organization admin in and establishes the session", async () => {
    login.mockResolvedValueOnce({
      accessToken: "access-1",
      user: { id: "u1", email: "admin@example.com", role: "ORGANIZATION_ADMIN", organizationId: "org-1" },
    });

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/work email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(useAuthStore.getState().accessToken).toBe("access-1");
  });

  it("shows the API's message when credentials are wrong", async () => {
    login.mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "Invalid email or password"));

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/work email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("refuses to build a web session for a STORE_MANAGER and revokes it server-side", async () => {
    login.mockResolvedValueOnce({
      accessToken: "access-2",
      user: { id: "u2", email: "manager@example.com", role: "STORE_MANAGER", organizationId: "org-1" },
    });

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/work email/i), "manager@example.com");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("roleNotSupported"));
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(logout).toHaveBeenCalled();
  });

  it("refuses to build a web session for an EMPLOYEE", async () => {
    login.mockResolvedValueOnce({
      accessToken: "access-3",
      user: { id: "u3", email: "employee@example.com", role: "EMPLOYEE", organizationId: "org-1" },
    });

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/work email/i), "employee@example.com");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("roleNotSupported"));
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("offers no SSO, password reset or remember-me affordance", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.queryByText(/sso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/keep me signed in/i)).not.toBeInTheDocument();
  });
});

describe("OrgSignupPage", () => {
  beforeEach(() => {
    setAuthStatus("unauthenticated");
  });

  it("requires a password of at least 8 characters", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrgSignupPage />);

    await user.type(screen.getByLabelText(/organization name/i), "Acme Retail");
    await user.type(screen.getByLabelText(/work email/i), "owner@acme.test");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(signupOrganization).not.toHaveBeenCalled();
  });

  it("creates the organization and signs the new admin straight in", async () => {
    signupOrganization.mockResolvedValueOnce({
      accessToken: "access-4",
      user: { id: "u4", email: "owner@acme.test", role: "ORGANIZATION_ADMIN", organizationId: "org-2" },
    });

    const user = userEvent.setup();
    renderWithProviders(<OrgSignupPage />);

    await user.type(screen.getByLabelText(/organization name/i), "Acme Retail");
    await user.type(screen.getByLabelText(/work email/i), "owner@acme.test");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(signupOrganization).toHaveBeenCalledWith("Acme Retail", "owner@acme.test", "Test1234!");
  });

  it("surfaces a duplicate-email conflict from the API", async () => {
    signupOrganization.mockRejectedValueOnce(
      new ApiError(409, "CONFLICT", "An account with this email already exists"),
    );

    const user = userEvent.setup();
    renderWithProviders(<OrgSignupPage />);

    await user.type(screen.getByLabelText(/organization name/i), "Acme Retail");
    await user.type(screen.getByLabelText(/work email/i), "taken@acme.test");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
  });
});
