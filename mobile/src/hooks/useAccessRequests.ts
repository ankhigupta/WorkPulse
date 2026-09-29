import { useMutation, useQuery } from "@tanstack/react-query";
import * as accessRequestsApi from "../api/accessRequests";
import * as organizationApi from "../api/organization";
import type { CreateAccessRequestInput } from "../types/accessRequest";

// On-demand lookups triggered by user action (typing a code, submitting a
// form) rather than data that should load automatically — useMutation
// fits both better than useQuery here, same reasoning as every create
// flow elsewhere in this app (useCreateEmployee, useCreateManager, ...).
export function useOrganizationLookup() {
  return useMutation({
    mutationFn: (code: string) => organizationApi.lookupOrganizationByCode(code),
  });
}

export function useCreateAccessRequest() {
  return useMutation({
    mutationFn: (input: CreateAccessRequestInput) => accessRequestsApi.createAccessRequest(input),
  });
}

// retry: false — a 404 here means "wrong id/token/gone," never a
// transient failure, so retrying just delays showing the correct
// unrecoverable-request message.
export function useAccessRequestStatus(requestId: string | undefined, statusToken: string | undefined) {
  return useQuery({
    queryKey: ["accessRequestStatus", requestId],
    queryFn: () => accessRequestsApi.getAccessRequestStatus(requestId as string, statusToken as string),
    enabled: Boolean(requestId && statusToken),
    retry: false,
    staleTime: 0,
  });
}
