import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as managersApi from "../api/managers";
import type { CreateManagerInput, Manager, UpdateManagerInput } from "../types/manager";

// Same fuzzy-matchable key scheme as useEmployees.ts — invalidating
// ["managers"] also invalidates every ["managers", id] detail query.
export const managersKey = ["managers"] as const;
export const managerDetailKey = (managerId: string) => ["managers", managerId] as const;

export function useManagerList() {
  return useQuery({
    queryKey: managersKey,
    queryFn: managersApi.listManagers,
    staleTime: 30_000,
  });
}

export function useManager(managerId: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: managerDetailKey(managerId),
    queryFn: () => managersApi.getManager(managerId),
    // The list and detail endpoints return the exact same shape (both go
    // through managerSelect) — seed from the already-loaded list for an
    // instant render, same pattern as useEmployee.
    initialData: () => queryClient.getQueryData<Manager[]>(managersKey)?.find((m) => m.id === managerId),
    staleTime: 30_000,
  });
}

export function useCreateManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManagerInput) => managersApi.createManager(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managersKey });
    },
  });
}

export function useUpdateManager(managerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateManagerInput) => managersApi.updateManager(managerId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: managersKey });
    },
  });
}
