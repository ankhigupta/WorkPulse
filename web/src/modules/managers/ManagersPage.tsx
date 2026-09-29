import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { DataTable, type Column } from "../../components/DataTable";
import { FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { MutedCell, PageHeader, PrimaryCell, RowActions } from "../../components/Layout";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { IconPlus } from "../../app/icons";
import { useCreateManager, useManager, useManagers, useStores, useUpdateManager } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Manager } from "../../types/domain";
import { formatDate, todayDateOnly } from "../../utils/format";

// A Manager always has a login account — email/password are required at
// creation and there is no credential-change endpoint afterwards, so the
// edit form deliberately omits them.
const createManagerSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  storeId: z.string().min(1, "Select a store"),
  joinedAt: z.string().min(1, "Joined date is required"),
});

type CreateManagerValues = z.infer<typeof createManagerSchema>;

function CreateManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const storesQuery = useStores();
  const createMutation = useCreateManager();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateManagerValues>({
    resolver: zodResolver(createManagerSchema),
    defaultValues: { email: "", password: "", storeId: "", joinedAt: todayDateOnly() },
  });

  useEffect(() => {
    if (open) {
      reset({ email: "", password: "", storeId: "", joinedAt: todayDateOnly() });
      setFormError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: CreateManagerValues) {
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        email: values.email.trim(),
        password: values.password,
        storeId: values.storeId,
        joinedAt: values.joinedAt,
      });
      showToast("Manager created", "success");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title="New store manager"
      description="Managers always sign in, so an email and password are required."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Create manager
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormError message={formError} /> : null}
        <TextField label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register("email")} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <FieldRow>
          <SelectField label="Store" error={errors.storeId?.message} {...register("storeId")}>
            <option value="">Select a store</option>
            {(storesQuery.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </SelectField>
          <TextField label="Joined on" type="date" error={errors.joinedAt?.message} {...register("joinedAt")} />
        </FieldRow>
      </form>
    </Modal>
  );
}

export function ManagersPage() {
  const managersQuery = useManagers();
  const storesQuery = useStores();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const storeNameById = useMemo(
    () => new Map((storesQuery.data ?? []).map((store) => [store.id, store.name])),
    [storesQuery.data],
  );

  const columns: Column<Manager>[] = [
    {
      key: "manager",
      header: "Manager",
      render: (manager) => <PrimaryCell name={manager.user.email} title={manager.user.email} />,
    },
    {
      key: "store",
      header: "Store",
      render: (manager) => <MutedCell>{storeNameById.get(manager.storeId) ?? "—"}</MutedCell>,
    },
    {
      key: "status",
      header: "Status",
      render: (manager) => (
        <StatusBadge label={manager.isActive ? "Active" : "Inactive"} tone={activeTone(manager.isActive)} />
      ),
    },
    {
      key: "joined",
      header: "Joined",
      align: "right",
      render: (manager) => <MutedCell>{formatDate(manager.joinedAt)}</MutedCell>,
    },
  ];

  if (managersQuery.isPending) {
    return (
      <>
        <PageHeader eyebrow="Workforce" title="Managers" />
        <LoadingState message="Loading managers…" />
      </>
    );
  }

  if (managersQuery.isError) {
    return (
      <>
        <PageHeader eyebrow="Workforce" title="Managers" />
        <ErrorState message={errorMessage(managersQuery.error)} onRetry={() => void managersQuery.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workforce"
        title="Managers"
        actions={
          <>
            <Button onClick={() => navigate("/employees")}>Employees</Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus />
              New manager
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={managersQuery.data}
        rowKey={(manager) => manager.id}
        onRowClick={(manager) => navigate(`/managers/${manager.id}`)}
        emptyTitle="No managers yet"
        emptyMessage="Store managers mark attendance and raise correction requests from the mobile app."
      />

      <CreateManagerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function ManagerDetailPage() {
  const { managerId = "" } = useParams();
  const managerQuery = useManager(managerId);
  const storesQuery = useStores();
  const updateMutation = useUpdateManager(managerId);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string>("");

  if (managerQuery.isPending) return <LoadingState message="Loading manager…" />;
  if (managerQuery.isError) {
    return <ErrorState message={errorMessage(managerQuery.error)} onRetry={() => void managerQuery.refetch()} />;
  }

  const manager = managerQuery.data;
  const currentStoreId = storeId || manager.storeId;

  async function save(input: { storeId?: string; isActive?: boolean }) {
    try {
      await updateMutation.mutateAsync(input);
      showToast("Manager updated", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workforce"
        title={manager.user.email}
        actions={
          <>
            <Button onClick={() => navigate("/managers")}>Back to managers</Button>
            <Button
              variant={manager.isActive ? "destructive" : "primary"}
              loading={updateMutation.isPending}
              onClick={() => void save({ isActive: !manager.isActive })}
            >
              {manager.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader title="Assignment" subtitle="Managers are scoped to exactly one store" />
        <p style={{ marginBottom: "var(--space-lg)" }}>
          <StatusBadge label={manager.isActive ? "Active" : "Inactive"} tone={activeTone(manager.isActive)} />
        </p>
        <SelectField label="Store" value={currentStoreId} onChange={(event) => setStoreId(event.target.value)}>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </SelectField>
        <p style={{ marginBottom: "var(--space-lg)" }}>Joined {formatDate(manager.joinedAt)}</p>
        <RowActions>
          <Button
            variant="primary"
            loading={updateMutation.isPending}
            disabled={currentStoreId === manager.storeId}
            onClick={() => void save({ storeId: currentStoreId })}
          >
            Save assignment
          </Button>
        </RowActions>
      </Card>
    </>
  );
}
