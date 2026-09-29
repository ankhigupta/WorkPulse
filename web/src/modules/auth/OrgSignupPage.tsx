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

// Mirrors the backend's signupOrganizationSchema — no extra rules invented
// client-side that the API wouldn't enforce anyway.
const signupSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required").max(255),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

export function OrgSignupPage() {
  const signupOrganization = useAuthStore((state) => state.signupOrganization);
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupValues) {
    setFormError(null);
    try {
      await signupOrganization(values.organizationName.trim(), values.email.trim(), values.password);
      const { user } = useAuthStore.getState();
      if (user) navigate(defaultRouteFor(user.role), { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <AuthLayout
      title="Create your organization"
      subtitle="You will be set up as the organization admin, with access straight away."
      footer={
        <span>
          Already have an account? <Link to="/login">Sign in</Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormError message={formError} /> : null}

        <TextField
          label="Organization name"
          placeholder="Acme Retail"
          error={errors.organizationName?.message}
          {...register("organizationName")}
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
          Create organization
        </Button>
      </form>
    </AuthLayout>
  );
}
