import { useState } from "react";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { FormError, TextField } from "../../components/Form";
import { ErrorState, LoadingState } from "../../components/States";
import { PageHeader, SplitGrid } from "../../components/Layout";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { useOrganization, useUpdateOrganization } from "../../hooks/queries";
import { useAuthStore } from "../../stores/authStore";
import { errorMessage } from "../../types/api";
import { formatDate } from "../../utils/format";
import styles from "./Organization.module.css";

export function OrganizationPage() {
  const organizationId = useAuthStore((state) => state.user?.organizationId) ?? "";
  const organizationQuery = useOrganization(organizationId);
  const updateMutation = useUpdateOrganization(organizationId);
  const { showToast } = useToast();

  // Undefined until the admin actually edits — the input falls back to the
  // server's own value, so no effect is needed to seed it.
  const [nameOverride, setNameOverride] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (organizationQuery.isPending) return <LoadingState message="Loading organization…" />;
  if (organizationQuery.isError) {
    return (
      <ErrorState
        message={errorMessage(organizationQuery.error)}
        onRetry={() => void organizationQuery.refetch()}
      />
    );
  }

  const organization = organizationQuery.data;
  const name = nameOverride ?? organization.name;

  async function save() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Organization name is required");
      return;
    }
    try {
      await updateMutation.mutateAsync({ name: name.trim() });
      showToast("Organization updated", "success");
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  async function copyJoinCode() {
    try {
      await navigator.clipboard.writeText(organization.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy — select the code and copy manually", "error");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title="Organization" />

      <SplitGrid>
        <Card>
          <CardHeader title="Details" subtitle="Your organization as it appears across WorkPulse" />
          {formError ? <FormError message={formError} /> : null}
          <TextField
            label="Organization name"
            value={name}
            onChange={(event) => setNameOverride(event.target.value)}
          />
          <div className={styles.metaRow}>
            <StatusBadge
              label={organization.isActive ? "Active" : "Inactive"}
              tone={activeTone(organization.isActive)}
            />
            <span className={styles.meta}>On WorkPulse since {formatDate(organization.createdAt)}</span>
          </div>
          <Button
            variant="primary"
            loading={updateMutation.isPending}
            disabled={name.trim() === organization.name}
            onClick={() => void save()}
          >
            Save changes
          </Button>
        </Card>

        {/* The join code is how employees and managers find this
            organization when they sign up on mobile — it's the piece an
            admin actually needs to read out, so it gets its own card. */}
        <Card>
          <CardHeader
            title="Join code"
            subtitle="Share this with employees and store managers signing up on the mobile app"
          />
          <div className={styles.joinCode}>{organization.joinCode}</div>
          <p className={styles.joinHelp}>
            Anyone with this code can request access. Requests still need your approval before an account is
            created — nothing is granted automatically.
          </p>
          <Button onClick={() => void copyJoinCode()}>{copied ? "Copied" : "Copy join code"}</Button>
        </Card>
      </SplitGrid>
    </>
  );
}
