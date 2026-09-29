import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeesPage } from "../EmployeesPage";
import { EmployeeFormModal } from "../EmployeeFormModal";
import type { Employee } from "../../../types/domain";
import { renderWithProviders, signInAs } from "../../../test/utils";

const listEmployees = vi.fn();
const createEmployee = vi.fn();

vi.mock("../../../api/employees", () => ({
  listEmployees: (...args: unknown[]) => listEmployees(...args),
  getEmployee: vi.fn(),
  createEmployee: (...args: unknown[]) => createEmployee(...args),
  updateEmployee: vi.fn(),
}));

vi.mock("../../../api/stores", () => ({
  listStores: vi.fn().mockResolvedValue([
    {
      id: "store-1",
      organizationId: "org-1",
      name: "Koramangala",
      address: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]),
  getStore: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
}));

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    storeId: "store-1",
    name: "Aarav Nair",
    dailyWage: "720.00",
    qrCodeToken: "qr-token",
    joinedAt: "2026-02-01T00:00:00.000Z",
    isActive: true,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    user: null,
    ...overrides,
  };
}

describe("EmployeesPage", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
    listEmployees.mockResolvedValue([
      makeEmployee(),
      makeEmployee({
        id: "emp-2",
        name: "Diya Kapoor",
        isActive: false,
        user: { id: "u-2", email: "diya@example.com", role: "EMPLOYEE", isActive: true },
      }),
    ]);
  });

  it("renders real employee fields only", async () => {
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText("Aarav Nair")).toBeInTheDocument();
    expect(screen.getAllByText("Koramangala").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹720/).length).toBeGreaterThan(0);

    // Present in the visual reference, absent from the API.
    expect(screen.queryByText(/EMP-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sales associate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/on leave/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
  });

  it("labels an account-less employee instead of hiding it", async () => {
    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText(/no login account/i)).toBeInTheDocument();
  });

  it("filters client-side by search term", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmployeesPage />);
    await screen.findByText("Aarav Nair");

    await user.type(screen.getByLabelText(/search employees/i), "Diya");

    await waitFor(() => expect(screen.queryByText("Aarav Nair")).not.toBeInTheDocument());
    expect(screen.getByText("Diya Kapoor")).toBeInTheDocument();
  });

  it("filters client-side by status", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmployeesPage />);
    await screen.findByText("Aarav Nair");

    await user.click(screen.getByRole("tab", { name: /inactive/i }));

    await waitFor(() => expect(screen.queryByText("Aarav Nair")).not.toBeInTheDocument());
    expect(screen.getByText("Diya Kapoor")).toBeInTheDocument();
  });
});

describe("EmployeeFormModal", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
  });

  it("creates an account-less employee when no login is requested", async () => {
    createEmployee.mockResolvedValueOnce(makeEmployee());
    const user = userEvent.setup();
    renderWithProviders(<EmployeeFormModal open onClose={() => {}} />);

    await user.type(await screen.findByLabelText(/full name/i), "Mohan Das");
    await screen.findByRole("option", { name: "Koramangala" });
    await user.selectOptions(screen.getByLabelText(/^store$/i), "store-1");
    await user.type(screen.getByLabelText(/daily wage/i), "640");
    await user.click(screen.getByRole("button", { name: /add employee/i }));

    await waitFor(() => expect(createEmployee).toHaveBeenCalled());
    const payload = createEmployee.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.name).toBe("Mohan Das");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("password");
  });

  it("only asks for credentials when an account is explicitly requested", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmployeeFormModal open onClose={() => {}} />);

    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/also create a login account/i));

    expect(await screen.findByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("requires both credentials together once an account is requested", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmployeeFormModal open onClose={() => {}} />);

    await user.type(await screen.findByLabelText(/full name/i), "Mohan Das");
    await screen.findByRole("option", { name: "Koramangala" });
    await user.selectOptions(screen.getByLabelText(/^store$/i), "store-1");
    await user.type(screen.getByLabelText(/daily wage/i), "640");
    await user.click(screen.getByLabelText(/also create a login account/i));
    await user.type(await screen.findByLabelText(/^email$/i), "mohan@example.com");
    await user.click(screen.getByRole("button", { name: /add employee/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(createEmployee).not.toHaveBeenCalled();
  });
});
