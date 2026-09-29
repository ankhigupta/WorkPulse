import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { defaultRouteFor } from "../../app/guards";
import { useAuthStore } from "../../stores/authStore";
import { AuthLayout } from "./AuthLayout";

export function NotFoundPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  return (
    <AuthLayout title="Page not found" subtitle="That page doesn't exist, or isn't available to your account.">
      <Button
        variant="primary"
        fullWidth
        onClick={() => navigate(user ? defaultRouteFor(user.role) : "/login", { replace: true })}
      >
        {user ? "Back to WorkPulse" : "Back to sign in"}
      </Button>
    </AuthLayout>
  );
}
