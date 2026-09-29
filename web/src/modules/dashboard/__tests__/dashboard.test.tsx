import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage";
import type { DashboardSummary } from "../../../types/domain";
import { renderWithProviders, signInAs } from "../../../test/utils";

const getDashboardSummary = vi.fn();

vi.mock("../../../api/reports", () => ({
  getDashboardSummary: (...args: unknown[]) => getDashboardSummary(...args),
  getAttendanceReport: vi.fn(),
  getPayrollReport: vi.fn(),
  getPaymentsReport: vi.fn(),
  getWorkforceReport: vi.fn(),
}));

vi.mock("../../../api/attendance", () => ({
  listCorrections: vi.fn().mockResolvedValue([]),
  listAttendance: vi.fn().mockResolvedValue([]),
  createAttendance: vi.fn(),
  approveCorrection: vi.fn(),
  rejectCorrection: vi.fn(),
}));

vi.mock("../../../api/employees", () => ({
  listEmployees: vi.fn().mockResolvedValue([]),
  getEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));

vi.mock("../../../api/stores", () => ({
  listStores: vi.fn().mockResolvedValue([]),
  getStore: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
}));

const summary: DashboardSummary = {
  period: { startDate: "2026-09-01", endDate: "2026-09-30" },
  organization: { id: "org-1", name: "Nilgiri Retail" },
  stores: { total: 6, active: 6 },
  employees: { total: 486, active: 461 },
  managers: { total: 6, active: 6 },
  attendance: { present: 418, absent: 26, total: 444, attendanceRate: 94.14 },
  payroll: { finalizedTotal: "7842600.00", draftTotal: "120000.00" },
  payments: { totalPaid: "3160000.00", totalOutstanding: "4682600.00" },
};

describe("DashboardPage", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
    getDashboardSummary.mockResolvedValue(summary);
  });

  it("renders the real figures the summary endpoint returns", async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Nilgiri Retail")).toBeInTheDocument();
    expect(screen.getByText("486")).toBeInTheDocument();
    expect(screen.getByText("418")).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument();
    expect(screen.getAllByText(/461 active/i).length).toBeGreaterThan(0);
  });

  it("renders no widget the API has no data for", async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText("Nilgiri Retail");

    // Every one of these appears in the visual reference and has no
    // backing endpoint — the dashboard must not invent them.
    expect(screen.queryByText(/on time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\blate\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/on leave/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recent activity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/projected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pay date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/employees in cycle/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/store overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/last 7 days/i)).not.toBeInTheDocument();
  });

  it("shows payroll and payment totals straight from the API without recomputing them", async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText("Nilgiri Retail");

    expect(screen.getByText(/78,42,600/)).toBeInTheDocument();
    expect(screen.getByText(/31,60,000/)).toBeInTheDocument();
    expect(screen.getByText(/46,82,600/)).toBeInTheDocument();
  });

  it("surfaces an error state rather than a blank dashboard", async () => {
    getDashboardSummary.mockRejectedValueOnce(new Error("network down"));
    renderWithProviders(<DashboardPage />);

    expect((await screen.findAllByText(/something went wrong/i)).length).toBeGreaterThan(0);
  });
});
