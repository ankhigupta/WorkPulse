import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/Button";
import { CheckboxField, FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { useToast } from "../../components/Toast";
import { useCreateEmployee, useStores, useUpdateEmployee } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Employee } from "../../types/domain";
import { todayDateOnly } from "../../utils/format";

// Mirrors createEmployeeSchema: email and password are optional but must
// be supplied together. Leaving both blank creates an account-less
// workforce record — a first-class case, not a degraded one.
const employeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255),
    storeId: z.string().min(1, "Select a store"),
    dailyWage: z.coerce.number().positive("Daily wage must be greater than zero"),
    joinedAt: z.string().min(1, "Joined date is required"),
    withAccount: z.boolean(),
    email: z.string().trim().optional(),
    password: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.withAccount) return;
    if (!values.email || !z.string().email().safeParse(values.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address" });
    }
    if (!values.password || values.password.length < 8) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password must be at least 8 characters" });
    }
  });

type EmployeeValues = z.input<typeof employeeSchema>;
type ParsedEmployeeValues = z.output<typeof employeeSchema>;

interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Present for edit; absent for create. */
  employee?: Employee;
}

export function EmployeeFormModal({ open, onClose, employee }: EmployeeFormModalProps) {
  const isEdit = Boolean(employee);
  const storesQuery = useStores();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee(employee?.id ?? "");
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeValues, unknown, ParsedEmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      storeId: "",
      dailyWage: undefined,
      joinedAt: todayDateOnly(),
      withAccount: false,
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      employee
        ? {
            name: employee.name,
            storeId: employee.storeId,
            dailyWage: Number(employee.dailyWage),
            joinedAt: employee.joinedAt.slice(0, 10),
            withAccount: false,
            email: "",
            password: "",
          }
        : {
            name: "",
            storeId: "",
            dailyWage: undefined,
            joinedAt: todayDateOnly(),
            withAccount: false,
            email: "",
            password: "",
          },
    );
    setFormError(null);
  }, [open, employee, reset]);

  const withAccount = watch("withAccount");

  async function onSubmit(values: ParsedEmployeeValues) {
    setFormError(null);
    try {
      if (employee) {
        // The API has no credential-change endpoint for employees, so edit
        // deliberately covers only the workforce fields.
        await updateMutation.mutateAsync({
          name: values.name.trim(),
          storeId: values.storeId,
          dailyWage: values.dailyWage,
          joinedAt: values.joinedAt,
        });
        showToast("Employee updated", "success");
      } else {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          storeId: values.storeId,
          dailyWage: values.dailyWage,
          joinedAt: values.joinedAt,
          ...(values.withAccount
            ? { email: (values.email ?? "").trim(), password: values.password as string }
            : {}),
        });
        showToast("Employee added", "success");
      }
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit employee" : "Add employee"}
      description={
        isEdit
          ? "Workforce details only — login credentials can't be changed from here."
          : "A login account is optional. Employees without one are still tracked for attendance, payroll and payments."
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {isEdit ? "Save changes" : "Add employee"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormError message={formError} /> : null}

        <TextField label="Full name" placeholder="Employee name" error={errors.name?.message} {...register("name")} />

        <SelectField label="Store" error={errors.storeId?.message} {...register("storeId")}>
          <option value="">Select a store</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </SelectField>

        <FieldRow>
          <TextField
            label="Daily wage"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            error={errors.dailyWage?.message}
            {...register("dailyWage")}
          />
          <TextField label="Joined on" type="date" error={errors.joinedAt?.message} {...register("joinedAt")} />
        </FieldRow>

        {!isEdit ? (
          <>
            <CheckboxField label="Also create a login account for this employee" {...register("withAccount")} />
            {withAccount ? (
              <FieldRow>
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="off"
                  placeholder="employee@company.com"
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
              </FieldRow>
            ) : null}
          </>
        ) : null}
      </form>
    </Modal>
  );
}
