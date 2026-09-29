// Mirrors backend/src/modules/accessRequests/accessRequest.schemas.ts and
// accessRequest.service.ts's public-facing shapes exactly — only the two
// public endpoints this app calls (create, status), never the admin-only
// list/approve/reject response shape.

export type RequestedRole = "EMPLOYEE" | "STORE_MANAGER";
export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CreateAccessRequestInput {
  organizationCode: string;
  email: string;
  password: string;
  name: string;
  requestedRole: RequestedRole;
}

export interface CreateAccessRequestResponse {
  requestId: string;
  statusToken: string;
}

export interface AccessRequestStatusResponse {
  status: AccessRequestStatus;
  organizationName: string;
}
