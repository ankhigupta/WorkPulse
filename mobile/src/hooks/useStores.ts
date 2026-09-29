import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStore, listStores, updateStore } from "../api/stores";
import type { CreateStoreInput, UpdateStoreInput } from "../types/store";

export const storesKey = ["stores"] as const;

// GET /api/stores 403s for STORE_MANAGER — callers pass `enabled: false` for
// that role so this never fires a request that's guaranteed to fail.
export function useStoreList(enabled = true) {
  return useQuery({
    queryKey: storesKey,
    queryFn: listStores,
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStoreInput) => createStore(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storesKey });
    },
  });
}

export function useUpdateStore(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateStoreInput) => updateStore(storeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storesKey });
    },
  });
}
