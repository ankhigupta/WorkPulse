import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/Button";
import { FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { useApproveAccessRequest, useStores } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { AccessRequest } from "../../types/domain";
import { roleLabel, todayDateOnly } from "../../utils/format";
import styles from "./AccessRequests.module.css";

/*
 * Mirrors the backend's discriminated union exactly. dailyWage exists only
 * on the EMPLOYEE branch — for a STORE_MANAGER approval the field is not
 * rendered and not submitted, because the API's .strict() schema rejects
 * it outright rather than ignoring it.
 *
 * The role selected here is what actually gets written. The requester's
 * `requestedRole` is a hint shown for context and is never trusted.
 */
const approvalSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("EMPLOYEE"),
    storeId: z.string().min(1, "Select a store"),
    joinedAt: z.string().min(1, "Joined date is required"),
    name: z.string().trim().min(1, "Name is required").max(255),
    dailyWage: z.coerce.number().positive("Daily wage must be greater than zero"),
  }),
  z.object({
    role: z.literal("STORE_MANAGER"),
    storeId: z.string().min(1, "Select a store"),
    joinedAt: z.string().min(1, "Joined date is required"),
  }),
]);

type ApprovalValues = z.input<typeof approvalSchema>;
type ParsedApprovalValues = z.output<typeof approvalSchema>;

interface ApproveRequestModalProps {
  request: AccessRequest | null;
  onClose: () => void;
}

export function ApproveRequestModal({ request, onClose }: ApproveRequestModalProps) {
  const storesQuery = useStores();
  const approveMutation = useApproveAccessRequest();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApprovalValues, unknown, ParsedApprovalValues>({
    resolver: zodResolver(approvalSchema),
    defaultValues: { role: "EMPLOYEE", storeId: "", joinedAt: todayDateOnly(), name: "", dailyWage: undefined },
  });

  useEffect(() => {
    if (!request) return;
    const requested = request.requestedRole === "STORE_MANAGER" ? "STORE_MANAGER" : "EMPLOYEE";
    reset(
      requested === "STORE_MANAGER"
        ? { role: "STORE_MANAGER", storeId: "", joinedAt: todayDateOnly() }
        : {
            role: "EMPLOYEE",
            storeId: "",
            joinedAt: todayDateOnly(),
            name: request.requestedName,
            dailyWage: undefined,
          },
    );
    setFormError(null);
  }, [request, reset]);

  const role = watch("role");

  async function onSubmit(values: ParsedApprovalValues) {
    if (!request) return;
    setFormError(null);
    try {
      await approveMutation.mutateAsync({
        requestId: request.id,
        input:
          values.role === "EMPLOYEE"
            ? {
                role: "EMPLOYEE",
                storeId: values.storeId,
                joinedAt: values.joinedAt,
                name: values.name.trim(),
                dailyWage: values.dailyWage,
              }
            : { role: "STORE_MANAGER", storeId: values.storeId, joinedAt: values.joinedAt },
      });
      showToast("Access request approved", "success");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={Boolean(request)}
      wide
      title="Approve access request"
      description="You decide the final role, store and terms — the requester only asked to join."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Approve and create account
          </Button>
        </>
      }
    >
      {request ? (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError ? <FormError message={formError} /> : null}

          <div className={styles.requesterSummary}>
            <div>
              <div className={styles.requesterEmail}>{request.email}</div>
              <div className={styles.requesterName}>{request.requestedName}</div>
            </div>
            <StatusBadge label={`Requested: ${roleLabel(request.requestedRole)}`} tone="outline" dot={false} />
          </div>

          <SelectField label="Approved role" error={errors.role?.message} {...register("role")}>
            <option value="EMPLOYEE">Employee</option>
            <option value="STORE_MANAGER">Store Manager</option>
          </SelectField>

          <SelectField label="Store" error={errors.storeId?.message} {...register("storeId")}>
            <option value="">Select a store</option>
            {(storesQuery.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </SelectField>

          {role === "EMPLOYEE" ? (
            <>
              <TextField
                label="Employee name"
                error={"name" in errors ? errors.name?.message : undefined}
                {...register("name")}
              />
              <FieldRow>
                <TextField
                  label="Daily wage"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  error={"dailyWage" in errors ? errors.dailyWage?.message : undefined}
                  {...register("dailyWage")}
                />
                <TextField
                  label="Joined on"
                  type="date"
                  error={errors.joinedAt?.message}
                  {...register("joinedAt")}
                />
              </FieldRow>
            </>
          ) : (
            <TextField label="Joined on" type="date" error={errors.joinedAt?.message} {...register("joinedAt")} />
          )}
        </form>
      ) : null}
    </Modal>
  );
}
