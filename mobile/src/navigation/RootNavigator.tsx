import { useAuthStore } from "../stores/authStore";
import { AuthNavigator } from "./AuthNavigator";
import { AppNavigator } from "./AppNavigator";

// Bootstrapping is handled by App.tsx (it keeps the splash screen up until
// bootstrap resolves), so by the time this renders, status is always either
// "authenticated" or "unauthenticated".
export function RootNavigator() {
  const status = useAuthStore((state) => state.status);
  return status === "authenticated" ? <AppNavigator /> : <AuthNavigator />;
}
