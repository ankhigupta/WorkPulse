import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as organizationApi from "../api/organization";
import type { UpdateOrganizationInput } from "../types/organization";

export const organizationKey = (organizationId: string) => ["organization", organizationId] as const;

export function useOrganization(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: organizationKey(organizationId),
    queryFn: () => organizationApi.getOrganization(organizationId),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) => organizationApi.updateOrganization(organizationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) });
    },
  });
}
