import { apiClient } from "./client";
import type { AccessRequest, AccessRequestStatus, EmployeeNote } from "../types/domain";

// The approval payload is a discriminated union on `role`, mirroring the
// backend's Zod schema exactly: a STORE_MANAGER approval has no dailyWage
// field at all, and sending one is a 422 (.strict()), not a silent ignore.
export type ApproveAccessRequestInput =
  | { role: "EMPLOYEE"; storeId: string; joinedAt: string; name?: string; dailyWage: number }
  | { role: "STORE_MANAGER"; storeId: string; joinedAt: string };

export async function listAccessRequests(status?: AccessRequestStatus): Promise<AccessRequest[]> {
  const { data } = await apiClient.get<AccessRequest[]>("/access-requests", {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function approveAccessRequest(
  requestId: string,
  input: ApproveAccessRequestInput,
): Promise<AccessRequest> {
  const { data } = await apiClient.post<AccessRequest>(`/access-requests/${requestId}/approve`, input);
  return data;
}

export async function rejectAccessRequest(requestId: string, reason?: string): Promise<AccessRequest> {
  const { data } = await apiClient.post<AccessRequest>(
    `/access-requests/${requestId}/reject`,
    reason ? { reason } : {},
  );
  return data;
}

export async function listEmployeeNotes(employeeId?: string): Promise<EmployeeNote[]> {
  const { data } = await apiClient.get<EmployeeNote[]>("/employee-notes", {
    params: employeeId ? { employeeId } : undefined,
  });
  return data;
}

export async function createEmployeeNote(input: { employeeId: string; body: string }): Promise<EmployeeNote> {
  const { data } = await apiClient.post<EmployeeNote>("/employee-notes", input);
  return data;
}
