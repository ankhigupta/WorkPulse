import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppCard, AppInput, AppText, EmptyState, LoadingState, ScreenContainer, StatusBadge } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useOrganization, useUpdateOrganization } from "../../hooks/useOrganization";
import { ApiError } from "../../types/api";
import { formatDateOnly, toDateOnlyString } from "../../utils/format";
import { colors, spacing } from "../../theme";

// Only ever reached by ORGANIZATION_ADMIN — GET/PATCH /organizations/:id
// let an org admin look up and rename *only their own* organization
// (organization.service.ts 404s anything else, not 403). isActive is a
// SUPER_ADMIN-only concern (platform suspend/reactivate) — shown here
// read-only, never editable from this app.
export function OrganizationScreen() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  const organizationQuery = useOrganization(organizationId ?? "", Boolean(organizationId));
  const updateMutation = useUpdateOrganization(organizationId ?? "");

  // No effect needed to seed this from the query: `nameOverride` starts
  // undefined (nothing typed yet) and the input falls back to the
  // server's own value until the admin actually edits it.
  const [nameOverride, setNameOverride] = useState<string | undefined>(undefined);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <ScreenContainer>
        <EmptyState icon="business-outline" title="No organization context" message="Your account has no organization assigned." />
      </ScreenContainer>
    );
  }

  if (organizationQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading organization…" />
      </ScreenContainer>
    );
  }

  if (organizationQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load organization"
          message={
            organizationQuery.error instanceof ApiError ? organizationQuery.error.message : "Something went wrong. Please try again."
          }
          actionLabel="Retry"
          onAction={() => organizationQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const organization = organizationQuery.data;
  const name = nameOverride ?? organization.name;
  const submitError = updateMutation.error
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name is required");
      return;
    }
    setNameError(null);
    updateMutation.mutate({ name: trimmed });
  }

  return (
    <ScreenContainer scroll>
      <AppCard style={styles.card}>
        <View style={styles.statusRow}>
          <AppText variant="label">STATUS</AppText>
          <StatusBadge label={organization.isActive ? "Active" : "Inactive"} tone={organization.isActive ? "success" : "neutral"} />
        </View>
        <AppText variant="bodySmall" style={styles.since}>
          On WorkPulse since {formatDateOnly(toDateOnlyString(organization.createdAt))}
        </AppText>
      </AppCard>

      <AppInput label="Organization name" value={name} onChangeText={setNameOverride} errorMessage={nameError ?? undefined} />

      {submitError ? (
        <AppText variant="bodySmall" style={styles.error}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton label="Save changes" onPress={handleSave} loading={updateMutation.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  since: {
    color: colors.textSecondary,
  },
  error: {
    color: colors.error,
    marginBottom: spacing.md,
  },
});
