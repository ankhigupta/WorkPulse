import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApproveRequestModal } from "../ApproveRequestModal";
import { AccessRequestsPage } from "../AccessRequestsPage";
import { ApiError } from "../../../types/api";
import type { AccessRequest } from "../../../types/domain";
import { renderWithProviders, signInAs } from "../../../test/utils";

const listAccessRequests = vi.fn();
const approveAccessRequest = vi.fn();
const rejectAccessRequest = vi.fn();

vi.mock("../../../api/accessRequests", () => ({
  listAccessRequests: (...args: unknown[]) => listAccessRequests(...args),
  approveAccessRequest: (...args: unknown[]) => approveAccessRequest(...args),
  rejectAccessRequest: (...args: unknown[]) => rejectAccessRequest(...args),
  listEmployeeNotes: vi.fn().mockResolvedValue([]),
  createEmployeeNote: vi.fn(),
}));

vi.mock("../../../api/stores", () => ({
  listStores: vi.fn().mockResolvedValue([
    { id: "store-1", organizationId: "org-1", name: "Koramangala", address: null, isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  ]),
  getStore: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
}));

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: "req-1",
    organizationId: "org-1",
    email: "rohan@example.com",
    requestedRole: "EMPLOYEE",
    requestedName: "Rohan Mehta",
    status: "PENDING",
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdUserId: null,
    createdAt: "2026-09-20T09:00:00.000Z",
    updatedAt: "2026-09-20T09:00:00.000Z",
    ...overrides,
  };
}

// The store list loads asynchronously, so the option has to exist before it
// can be selected.
async function selectStore(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "Koramangala" });
  await user.selectOptions(screen.getByLabelText(/^store$/i), "store-1");
}

describe("access request approval form", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
    listAccessRequests.mockResolvedValue([]);
  });

  it("prefills from the request but still requires the admin to choose the store and wage", async () => {
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    expect(await screen.findByDisplayValue("Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByLabelText(/^store$/i)).toHaveValue("");
    expect(screen.getByLabelText(/daily wage/i)).toHaveValue(null);
  });

  it("shows the requested role as context, distinct from the approved role control", async () => {
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    expect(await screen.findByText(/requested: employee/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/approved role/i)).toBeInTheDocument();
  });

  it("offers only EMPLOYEE and STORE_MANAGER as approvable roles", async () => {
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    const select = await screen.findByLabelText(/approved role/i);
    const values = Array.from(select.querySelectorAll("option")).map((option) => option.value);

    expect(values).toEqual(["EMPLOYEE", "STORE_MANAGER"]);
    expect(values).not.toContain("ORGANIZATION_ADMIN");
    expect(values).not.toContain("SUPER_ADMIN");
  });

  it("renders no wage field when approving as a store manager", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    await user.selectOptions(await screen.findByLabelText(/approved role/i), "STORE_MANAGER");

    expect(screen.queryByLabelText(/daily wage/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/employee name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/joined on/i)).toBeInTheDocument();
  });

  it("submits a manager approval without a dailyWage key at all", async () => {
    approveAccessRequest.mockResolvedValueOnce(makeRequest({ status: "APPROVED" }));
    const user = userEvent.setup();
    renderWithProviders(
      <ApproveRequestModal request={makeRequest({ requestedRole: "STORE_MANAGER" })} onClose={() => {}} />,
    );

    await selectStore(user);
    await user.click(screen.getByRole("button", { name: /approve and create account/i }));

    await waitFor(() => expect(approveAccessRequest).toHaveBeenCalled());
    const [, input] = approveAccessRequest.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.role).toBe("STORE_MANAGER");
    expect(input).not.toHaveProperty("dailyWage");
    expect(input).not.toHaveProperty("name");
  });

  it("requires a positive daily wage for an employee approval", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    await selectStore(user);
    await user.click(screen.getByRole("button", { name: /approve and create account/i }));

    expect(await screen.findByText(/daily wage must be greater than zero/i)).toBeInTheDocument();
    expect(approveAccessRequest).not.toHaveBeenCalled();
  });

  it("submits the admin's chosen role, not the requested one", async () => {
    approveAccessRequest.mockResolvedValueOnce(makeRequest({ status: "APPROVED" }));
    const user = userEvent.setup();
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    await user.selectOptions(await screen.findByLabelText(/approved role/i), "STORE_MANAGER");
    await user.selectOptions(screen.getByLabelText(/^store$/i), "store-1");
    await user.click(screen.getByRole("button", { name: /approve and create account/i }));

    await waitFor(() => expect(approveAccessRequest).toHaveBeenCalled());
    const [, input] = approveAccessRequest.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.role).toBe("STORE_MANAGER");
  });

  it("surfaces an already-processed conflict instead of failing silently", async () => {
    approveAccessRequest.mockRejectedValueOnce(
      new ApiError(409, "CONFLICT", "This access request has already been processed"),
    );
    const user = userEvent.setup();
    renderWithProviders(<ApproveRequestModal request={makeRequest()} onClose={() => {}} />);

    await selectStore(user);
    await user.type(screen.getByLabelText(/daily wage/i), "650");
    await user.click(screen.getByRole("button", { name: /approve and create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already been processed/i);
  });
});

describe("access requests page", () => {
  beforeEach(() => {
    signInAs("ORGANIZATION_ADMIN");
  });

  it("lists pending requests with the requested role marked as a request", async () => {
    listAccessRequests.mockResolvedValue([makeRequest()]);
    renderWithProviders(<AccessRequestsPage />);

    expect(await screen.findByText("rohan@example.com")).toBeInTheDocument();
    expect(screen.getAllByText(/employee/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });

  it("sends an optional admin-only reason when rejecting", async () => {
    listAccessRequests.mockResolvedValue([makeRequest()]);
    rejectAccessRequest.mockResolvedValueOnce(makeRequest({ status: "REJECTED" }));

    const user = userEvent.setup();
    renderWithProviders(<AccessRequestsPage />);

    await user.click(await screen.findByRole("button", { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/reason/i), "Could not verify identity");
    await user.click(screen.getByRole("button", { name: /reject request/i }));

    await waitFor(() =>
      expect(rejectAccessRequest).toHaveBeenCalledWith("req-1", "Could not verify identity"),
    );
  });
});
