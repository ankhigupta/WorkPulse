import { useAuthStore } from "../stores/authStore";
import { usePendingAccessRequestStore } from "../stores/pendingAccessRequestStore";
import { AuthNavigator } from "./AuthNavigator";
import { AppNavigator } from "./AppNavigator";

// Bootstrapping is handled by App.tsx (it keeps the splash screen up until
// both auth bootstrap AND the pending-access-request load resolve), so by
// the time this renders, status is always either "authenticated" or
// "unauthenticated", and pendingAccessRequestStore is already hydrated —
// no flash where AuthNavigator briefly mounts on Login before switching.
//
// An authenticated user is never routed to RequestStatus, regardless of
// stale pending-request data — that data only matters while unauthenticated.
export function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  const hasPendingAccessRequest = usePendingAccessRequestStore((state) => state.data !== null);

  if (status === "authenticated") {
    return <AppNavigator />;
  }

  return <AuthNavigator initialRouteName={hasPendingAccessRequest ? "RequestStatus" : "Login"} />;
}
