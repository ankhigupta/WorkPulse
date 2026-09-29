import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { useAuthStore } from "../../stores/authStore";
import { AuthLayout } from "./AuthLayout";

// Reached when a STORE_MANAGER or EMPLOYEE authenticates successfully but
// has no web application to enter. The session was already cleared and the
// server-side refresh token revoked by the auth store — this page only
// explains why. Backend RBAC, not this screen, is what actually protects
// the data.
export function RoleNotSupportedPage() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <AuthLayout
      title="Use the WorkPulse mobile app"
      subtitle="Your role works on mobile, where attendance and day-to-day store operations live. WorkPulse Web is for organization admins and platform administration."
    >
      <Button
        variant="primary"
        fullWidth
        onClick={() => {
          clearSession();
          navigate("/login", { replace: true });
        }}
      >
        Back to sign in
      </Button>
    </AuthLayout>
  );
}
