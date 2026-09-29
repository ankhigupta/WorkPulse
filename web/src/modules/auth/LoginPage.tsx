import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/Button";
import { FormError, TextField } from "../../components/Form";
import { defaultRouteFor } from "../../app/guards";
import { useAuthStore } from "../../stores/authStore";
import { errorMessage } from "../../types/api";
import { AuthLayout } from "./AuthLayout";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Work email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await login(values.email.trim(), values.password);
      const { status, user } = useAuthStore.getState();
      // A STORE_MANAGER/EMPLOYEE authenticates successfully against the
      // backend but has no web application — the store already cleared the
      // session, so route them to the explanation instead of a shell.
      if (status === "roleNotSupported") {
        navigate("/role-unsupported", { replace: true });
        return;
      }
      if (user) navigate(defaultRouteFor(user.role), { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your stores, teams and payroll."
      footer={
        <>
          <span>
            New to WorkPulse? <Link to="/signup/organization">Create an organization</Link>
          </span>
          <span>Employees and store managers use the WorkPulse mobile app.</span>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormError message={formError} /> : null}

        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
