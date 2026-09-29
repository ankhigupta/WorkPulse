import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { DataTable, type Column } from "../../components/DataTable";
import { FormError, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { MutedCell, PageHeader, RowActions, SplitGrid } from "../../components/Layout";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { IconPlus } from "../../app/icons";
import { useCreateStore, useEmployees, useManagers, useStores, useUpdateStore } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Store } from "../../types/domain";
import { formatDate } from "../../utils/format";

const storeSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(255),
  address: z.string().trim().max(500).optional(),
});

type StoreValues = z.infer<typeof storeSchema>;

function StoreFormModal({ open, onClose, store }: { open: boolean; onClose: () => void; store?: Store }) {
  const createMutation = useCreateStore();
  const updateMutation = useUpdateStore(store?.id ?? "");
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StoreValues>({ resolver: zodResolver(storeSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ name: store?.name ?? "", address: store?.address ?? "" });
    setFormError(null);
  }, [open, store, reset]);

  async function onSubmit(values: StoreValues) {
    setFormError(null);
    const payload = { name: values.name.trim(), address: values.address?.trim() || undefined };
    try {
      if (store) {
        await updateMutation.mutateAsync(payload);
        showToast("Store updated", "success");
      } else {
        await createMutation.mutateAsync(payload);
        showToast("Store created", "success");
      }
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title={store ? "Edit store" : "New store"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {store ? "Save changes" : "Create store"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormError message={formError} /> : null}
        <TextField label="Store name" placeholder="Koramangala Flagship" error={errors.name?.message} {...register("name")} />
        <TextField label="Address (optional)" placeholder="Street, city" error={errors.address?.message} {...register("address")} />
      </form>
    </Modal>
  );
}

export function StoresPage() {
  const storesQuery = useStores();
  const employeesQuery = useEmployees();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const columns: Column<Store>[] = [
    { key: "name", header: "Store", render: (store) => store.name },
    { key: "address", header: "Address", render: (store) => <MutedCell>{store.address ?? "—"}</MutedCell> },
    {
      key: "employees",
      header: "Employees",
      align: "right",
      render: (store) => (employeesQuery.data ?? []).filter((employee) => employee.storeId === store.id).length,
    },
    {
      key: "status",
      header: "Status",
      render: (store) => (
        <StatusBadge label={store.isActive ? "Active" : "Inactive"} tone={activeTone(store.isActive)} />
      ),
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (store) => <MutedCell>{formatDate(store.createdAt)}</MutedCell>,
    },
  ];

  if (storesQuery.isPending) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title="Stores" />
        <LoadingState message="Loading stores…" />
      </>
    );
  }

  if (storesQuery.isError) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title="Stores" />
        <ErrorState message={errorMessage(storesQuery.error)} onRetry={() => void storesQuery.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Stores"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            New store
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={storesQuery.data}
        rowKey={(store) => store.id}
        onRowClick={(store) => navigate(`/stores/${store.id}`)}
        emptyTitle="No stores yet"
        emptyMessage="Create your first store before adding employees."
      />

      <StoreFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function StoreDetailPage() {
  const { storeId = "" } = useParams();
  const storesQuery = useStores();
  const employeesQuery = useEmployees();
  const managersQuery = useManagers();
  const updateMutation = useUpdateStore(storeId);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  if (storesQuery.isPending) return <LoadingState message="Loading store…" />;
  if (storesQuery.isError) {
    return <ErrorState message={errorMessage(storesQuery.error)} onRetry={() => void storesQuery.refetch()} />;
  }

  const store = storesQuery.data.find((candidate) => candidate.id === storeId);
  if (!store) {
    return <ErrorState title="Store not found" message="This store doesn't exist in your organization." />;
  }

  const storeEmployees = (employeesQuery.data ?? []).filter((employee) => employee.storeId === store.id);
  const storeManagers = (managersQuery.data ?? []).filter((manager) => manager.storeId === store.id);

  async function toggleActive() {
    try {
      await updateMutation.mutateAsync({ isActive: !store!.isActive });
      showToast(store!.isActive ? "Store deactivated" : "Store reactivated", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={store.name}
        actions={
          <>
            <Button onClick={() => navigate("/stores")}>Back to stores</Button>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            <Button
              variant={store.isActive ? "destructive" : "primary"}
              loading={updateMutation.isPending}
              onClick={() => void toggleActive()}
            >
              {store.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        }
      />

      <SplitGrid>
        <Card>
          <CardHeader title="Details" />
          <p>
            <StatusBadge label={store.isActive ? "Active" : "Inactive"} tone={activeTone(store.isActive)} />
          </p>
          <p style={{ marginTop: "var(--space-lg)" }}>{store.address ?? "No address recorded"}</p>
        </Card>

        <Card>
          <CardHeader title="People" subtitle="Assigned to this store" />
          <p>
            {storeEmployees.length} {storeEmployees.length === 1 ? "employee" : "employees"} ·{" "}
            {storeManagers.length} {storeManagers.length === 1 ? "manager" : "managers"}
          </p>
          <RowActions>
            <Button size="small" onClick={() => navigate("/employees")}>
              View employees
            </Button>
          </RowActions>
        </Card>
      </SplitGrid>

      <StoreFormModal open={editOpen} onClose={() => setEditOpen(false)} store={store} />
    </>
  );
}
