import { useQuery } from "@tanstack/react-query";
import { listStores } from "../api/stores";

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
