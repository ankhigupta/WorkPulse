import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { DataTable, type Column } from "../../components/DataTable";
import { FormError, TextField } from "../../components/Form";
import { ConfirmDialog, Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import {
  FilterBar,
  MutedCell,
  PageHeader,
  SearchField,
  Segmented,
  SplitGrid,
  StatGrid,
} from "../../components/Layout";
import { StatCard } from "../../components/StatCard";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { IconPlus } from "../../app/icons";
import { createOrganization } from "../../api/organizations";
import { queryKeys, useOrganizations, useUpdateOrganization } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Organization } from "../../types/domain";
import { formatDate, formatNumber } from "../../utils/format";
import styles from "./SuperAdmin.module.css";

type StatusFilter = "all" | "active" | "inactive";

// Stable identity so the memos below don't recompute on every render.
const NO_ORGANIZATIONS: Organization[] = [];

/*
 * Platform administration only. The backend exposes no cross-organization
 * analytics — no revenue, usage, headcount or activity endpoints — so this
 * console does exactly what the API supports: list organizations, create
 * one, rename it, and suspend or reactivate it. Nothing about an
 * organization's employees, payroll or payments is reachable from here,
 * because a SUPER_ADMIN is not authorized for any of it.
 */
export function SuperOrganizationsPage() {
  const organizationsQuery = useOrganizations();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const organizations = organizationsQuery.data ?? NO_ORGANIZATIONS;

  const counts = useMemo(
    () => ({
      all: organizations.length,
      active: organizations.filter((organization) => organization.isActive).length,
      inactive: organizations.filter((organization) => !organization.isActive).length,
    }),
    [organizations],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return organizations.filter((organization) => {
      if (status === "active" && !organization.isActive) return false;
      if (status === "inactive" && organization.isActive) return false;
      if (!term) return true;
      return organization.name.toLowerCase().includes(term);
    });
  }, [organizations, search, status]);

  const columns: Column<Organization>[] = [
    { key: "name", header: "Organization", render: (organization) => organization.name },
    {
      key: "status",
      header: "Status",
      render: (organization) => (
        <StatusBadge
          label={organization.isActive ? "Active" : "Suspended"}
          tone={activeTone(organization.isActive)}
        />
      ),
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (organization) => <MutedCell>{formatDate(organization.createdAt)}</MutedCell>,
    },
  ];

  if (organizationsQuery.isPending) {
    return (
      <>
        <PageHeader eyebrow="Platform" title="Organizations" />
        <LoadingState message="Loading organizations…" />
      </>
    );
  }

  if (organizationsQuery.isError) {
    return (
      <>
        <PageHeader eyebrow="Platform" title="Organizations" />
        <ErrorState
          message={errorMessage(organizationsQuery.error)}
          onRetry={() => void organizationsQuery.refetch()}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Organizations"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            New organization
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Organizations" value={formatNumber(counts.all)} />
        <StatCard label="Active" value={formatNumber(counts.active)} tone="success" />
        <StatCard label="Suspended" value={formatNumber(counts.inactive)} />
      </StatGrid>

      <FilterBar>
        <SearchField
          label="Search organizations"
          placeholder="Search by name"
          value={search}
          onChange={setSearch}
        />
        <Segmented
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Active", count: counts.active },
            { value: "inactive", label: "Suspended", count: counts.inactive },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(organization) => organization.id}
        onRowClick={(organization) => navigate(`/super/organizations/${organization.id}`)}
        emptyTitle="No organizations match this filter"
      />

      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (organizationName: string) => createOrganization(organizationName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations }),
  });

  async function submit() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Organization name is required");
      return;
    }
    try {
      await createMutation.mutateAsync(name.trim());
      showToast("Organization created", "success");
      setName("");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title="New organization"
      description="Creates the tenant only. Its first admin signs up separately, or is created by you out of band."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createMutation.isPending} onClick={() => void submit()}>
            Create
          </Button>
        </>
      }
    >
      {formError ? <FormError message={formError} /> : null}
      <TextField
        label="Organization name"
        placeholder="Acme Retail"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
    </Modal>
  );
}

export function SuperOrganizationDetailPage() {
  const { organizationId = "" } = useParams();
  const organizationsQuery = useOrganizations();
  const updateMutation = useUpdateOrganization(organizationId);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState(false);

  if (organizationsQuery.isPending) return <LoadingState message="Loading organization…" />;
  if (organizationsQuery.isError) {
    return (
      <ErrorState
        message={errorMessage(organizationsQuery.error)}
        onRetry={() => void organizationsQuery.refetch()}
      />
    );
  }

  const organization = organizationsQuery.data.find((candidate) => candidate.id === organizationId);
  if (!organization) {
    return <ErrorState title="Organization not found" message="This organization no longer exists." />;
  }

  const currentName = name ?? organization.name;

  async function save(input: { name?: string; isActive?: boolean }) {
    try {
      await updateMutation.mutateAsync(input);
      showToast("Organization updated", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setConfirmToggle(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title={organization.name}
        actions={
          <>
            <Button onClick={() => navigate("/super/organizations")}>Back</Button>
            <Button
              variant={organization.isActive ? "destructive" : "primary"}
              onClick={() => setConfirmToggle(true)}
            >
              {organization.isActive ? "Suspend" : "Reactivate"}
            </Button>
          </>
        }
      />

      <SplitGrid>
        <Card>
          <CardHeader title="Details" />
          <TextField
            label="Organization name"
            value={currentName}
            onChange={(event) => setName(event.target.value)}
          />
          <div className={styles.metaRow}>
            <StatusBadge
              label={organization.isActive ? "Active" : "Suspended"}
              tone={activeTone(organization.isActive)}
            />
            <span className={styles.meta}>Created {formatDate(organization.createdAt)}</span>
          </div>
          <Button
            variant="primary"
            loading={updateMutation.isPending}
            disabled={currentName.trim() === organization.name || !currentName.trim()}
            onClick={() => void save({ name: currentName.trim() })}
          >
            Save changes
          </Button>
        </Card>

        <Card>
          <CardHeader title="Platform controls" subtitle="What suspension actually does" />
          <p className={styles.explainer}>
            A suspended organization stops accepting new access requests — its join code resolves as
            not-found, exactly like an unknown code, so suspension can't be probed from outside.
          </p>
          <p className={styles.explainer}>
            Nothing is deleted. Employees, attendance, payroll and payment history are all retained, and
            reactivating restores the organization as it was.
          </p>
        </Card>
      </SplitGrid>

      <ConfirmDialog
        open={confirmToggle}
        title={organization.isActive ? "Suspend this organization?" : "Reactivate this organization?"}
        message={
          organization.isActive
            ? "New access requests will stop working for this organization. No data is deleted."
            : "The organization will accept access requests again."
        }
        confirmLabel={organization.isActive ? "Suspend" : "Reactivate"}
        destructive={organization.isActive}
        loading={updateMutation.isPending}
        onConfirm={() => void save({ isActive: !organization.isActive })}
        onCancel={() => setConfirmToggle(false)}
      />
    </>
  );
}
