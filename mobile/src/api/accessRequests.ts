import { apiClient } from "./client";
import type { AccessRequestStatusResponse, CreateAccessRequestInput, CreateAccessRequestResponse } from "../types/accessRequest";

// Public, pre-auth endpoints only — list/approve/reject are
// ORGANIZATION_ADMIN-only and out of scope for this milestone (no
// approval UI yet).
export async function createAccessRequest(input: CreateAccessRequestInput): Promise<CreateAccessRequestResponse> {
  const { data } = await apiClient.post<CreateAccessRequestResponse>("/access-requests", input);
  return data;
}

export async function getAccessRequestStatus(requestId: string, statusToken: string): Promise<AccessRequestStatusResponse> {
  const { data } = await apiClient.get<AccessRequestStatusResponse>(`/access-requests/${requestId}/status`, {
    params: { token: statusToken },
  });
  return data;
}
