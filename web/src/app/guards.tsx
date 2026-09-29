import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "../components/States";
import { useAuthStore } from "../stores/authStore";
import type { Role } from "../types/domain";

export function defaultRouteFor(role: Role): string {
  return role === "SUPER_ADMIN" ? "/super/organizations" : "/dashboard";
}

/** Full-screen hold while the session is being restored — the shell is
 *  never rendered before the role is known, so there's no flash of the
 *  wrong application. */
function BootstrapGate() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <LoadingState />
    </div>
  );
}

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (status === "bootstrapping") return <BootstrapGate />;
  if (status === "roleNotSupported") return <Navigate to="/role-unsupported" replace />;
  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // A signed-in admin reaching the other role's tree gets the 404 page, not
  // a "forbidden" — the same reasoning the backend uses when it 404s a
  // resource outside your organization rather than confirming it exists.
  if (!roles.includes(user.role)) return <Navigate to="/not-found" replace />;

  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === "bootstrapping") return <BootstrapGate />;
  if (status === "authenticated" && user) return <Navigate to={defaultRouteFor(user.role)} replace />;

  return <>{children}</>;
}

export function RootRedirect() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === "bootstrapping") return <BootstrapGate />;
  if (status === "roleNotSupported") return <Navigate to="/role-unsupported" replace />;
  if (status === "authenticated" && user) return <Navigate to={defaultRouteFor(user.role)} replace />;

  return <Navigate to="/login" replace />;
}
