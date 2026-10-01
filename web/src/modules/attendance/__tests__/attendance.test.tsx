import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendancePage } from "../AttendancePage";
import type { Attendance } from "../../../types/domain";
import { renderWithProviders, signInAs } from "../../../test/utils";

const listAttendance = vi.fn();
const createAttendance = vi.fn();
const updateAttendanceStatus = vi.fn();

const { employee101, employee201, stores } = vi.hoisted(() => {
  function makeEmployee(overrides: Record<string, unknown>) {
    return {
      id: "emp-1",
      organizationId: "org-1",
      storeId: "store-1",
      name: "Aarav Nair",
      dailyWage: "720.00",
      qrCodeToken: "qr",
      joinedAt: "2026-01-01T00:00:00.000Z",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      user: null,
      ...overrides,
    };
  }
  return {
    employee101: makeEmployee({ id: "emp-101", name: "Employee 101", storeId: "store-1" }),
    employee201: makeEmployee({ id: "emp-201", name: "Employee 201", storeId: "store-2" }),
    stores: [
      { id: "store-1", organizationId: "org-1", name: "Koramangala", address: null, isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "store-2", organizationId: "org-1", name: "Indiranagar", address: null, isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  };
});

vi.mock("../../../api/attendance", () => ({
  listAttendance: (...args: unknown[]) => listAttendance(...args),
  createAttendance: (...args: unknown[]) => createAttendance(...args),
  updateAttendanceStatus: (...args: unknown[]) => updateAttendanceStatus(...args),
  listCorrections: vi.fn().mockResolvedValue([]),
  approveCorrection: vi.fn(),
  rejectCorrection: vi.fn(),
}));

vi.mock("../../../api/stores", () => ({
  listStores: vi.fn().mockResolvedValue(stores),
  getStore: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
}));

vi.mock("../../../api/employees", () => ({
  listEmployees: vi.fn().mockResolvedValue([employee101, employee201]),
  getEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: "att-1",
    employeeId: employee201.id,
    storeId: "store-2",
    organizationId: "org-1",
    date: "2026-10-01T00:00:00.000Z",
    status: "PRESENT",
    method: "MANUAL",
    checkInAt: null,
    markedByUserId: "user-1",
    statusChangedByUserId: null,
    statusChangedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Mark attendance — store filter", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
    listAttendance.mockResolvedValue([]);
  });

  it("the store select filters the employee dropdown to that store", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AttendancePage />);

    await user.click(await screen.findByRole("button", { name: /mark attendance/i }));

    const employeeSelect = await screen.findByLabelText(/^employee$/i);
    expect(within(employeeSelect).getByRole("option", { name: "Employee 101" })).toBeInTheDocument();
    expect(within(employeeSelect).getByRole("option", { name: "Employee 201" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^store$/i), "store-2");

    expect(within(employeeSelect).queryByRole("option", { name: "Employee 101" })).not.toBeInTheDocument();
    expect(within(employeeSelect).getByRole("option", { name: "Employee 201" })).toBeInTheDocument();
  });

  it("the store filter never sends a storeId to the create call", async () => {
    createAttendance.mockResolvedValueOnce(makeAttendance());
    const user = userEvent.setup();
    renderWithProviders(<AttendancePage />);

    await user.click(await screen.findByRole("button", { name: /mark attendance/i }));
    await user.selectOptions(screen.getByLabelText(/^store$/i), "store-2");
    await user.selectOptions(await screen.findByLabelText(/^employee$/i), "emp-201");
    await user.click(screen.getByRole("button", { name: /^record$/i }));

    await waitFor(() => expect(createAttendance).toHaveBeenCalled());
    const payload = createAttendance.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("storeId");
    expect(payload.employeeId).toBe("emp-201");
  });
});

describe("Edit attendance — organization admin direct edit", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
  });

  it("opens with the record's current status, not PENDING or any other invented state", async () => {
    listAttendance.mockResolvedValue([makeAttendance({ status: "PRESENT" })]);
    const user = userEvent.setup();
    renderWithProviders(<AttendancePage />);

    await user.click(await screen.findByRole("button", { name: /^edit$/i }));

    expect(await screen.findByLabelText(/current status/i)).toHaveValue("Present");
    expect(screen.getByLabelText(/new status/i)).toHaveValue("PRESENT");
  });

  it("changing PRESENT to ABSENT and saving calls the update endpoint with the new status", async () => {
    listAttendance.mockResolvedValue([makeAttendance({ id: "att-201", status: "PRESENT" })]);
    updateAttendanceStatus.mockResolvedValueOnce(makeAttendance({ id: "att-201", status: "ABSENT" }));
    const user = userEvent.setup();
    renderWithProviders(<AttendancePage />);

    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    await user.selectOptions(await screen.findByLabelText(/new status/i), "ABSENT");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(updateAttendanceStatus).toHaveBeenCalledWith("att-201", "ABSENT"));
  });

  it("the Save button is disabled until a different status is actually selected", async () => {
    listAttendance.mockResolvedValue([makeAttendance({ status: "PRESENT" })]);
    const user = userEvent.setup();
    renderWithProviders(<AttendancePage />);

    await user.click(await screen.findByRole("button", { name: /^edit$/i }));

    expect(await screen.findByRole("button", { name: /save changes/i })).toBeDisabled();
  });
});
