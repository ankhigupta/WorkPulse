import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AppRoutes } from "../routes";
import { renderWithProviders, setAuthStatus, signInAs } from "../../test/utils";

// Every page under the shells fetches through the api client; the shells
// themselves fetch organization/store/badge data. Stubbing the client keeps
// these tests about routing and role gating rather than data loading.
vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
    },
  };
});

describe("role-based routing", () => {
  beforeEach(() => {
    setAuthStatus("unauthenticated");
  });

  it("sends an unauthenticated visitor to the login page", async () => {
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("holds without rendering either shell while the session is still being restored", () => {
    setAuthStatus("bootstrapping");
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /welcome back/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/platform administration/i)).not.toBeInTheDocument();
  });

  it("renders the organization admin shell for an ORGANIZATION_ADMIN", async () => {
    signInAs("ORGANIZATION_ADMIN");
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    expect(await screen.findByRole("link", { name: /access requests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /payroll/i })).toBeInTheDocument();
  });

  it("keeps an ORGANIZATION_ADMIN out of the super admin tree", async () => {
    signInAs("ORGANIZATION_ADMIN");
    renderWithProviders(<AppRoutes />, { route: "/super/organizations" });

    expect(await screen.findByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  it("renders the platform shell for a SUPER_ADMIN, without organization-admin navigation", async () => {
    signInAs("SUPER_ADMIN");
    renderWithProviders(<AppRoutes />, { route: "/super/organizations" });

    expect(await screen.findByRole("link", { name: /organizations/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /payroll/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /access requests/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^employees$/i })).not.toBeInTheDocument();
  });

  it("keeps a SUPER_ADMIN out of the organization admin tree", async () => {
    signInAs("SUPER_ADMIN");
    renderWithProviders(<AppRoutes />, { route: "/employees" });

    expect(await screen.findByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  it("shows the mobile-app explanation for an unsupported web role", async () => {
    setAuthStatus("roleNotSupported");
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    expect(await screen.findByRole("heading", { name: /use the workpulse mobile app/i })).toBeInTheDocument();
  });

  it("sends an authenticated admin away from the login page to their own landing route", async () => {
    signInAs("ORGANIZATION_ADMIN");
    renderWithProviders(<AppRoutes />, { route: "/login" });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /welcome back/i })).not.toBeInTheDocument();
    });
  });
});
