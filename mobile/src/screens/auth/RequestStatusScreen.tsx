import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppText, EmptyState, LoadingState, ScreenContainer, StatusBadge, type StatusTone } from "../../components";
import { usePendingAccessRequestStore } from "../../stores/pendingAccessRequestStore";
import { useAccessRequestStatus } from "../../hooks/useAccessRequests";
import { colors, spacing } from "../../theme";
import type { AccessRequestStatus } from "../../types/accessRequest";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "RequestStatus">;

const statusCopy: Record<AccessRequestStatus, { tone: StatusTone; label: string; explanation: string }> = {
  PENDING: {
    tone: "warning",
    label: "Pending",
    explanation: "Your organization admin hasn't reviewed this request yet. Check back later.",
  },
  APPROVED: {
    tone: "success",
    label: "Approved",
    explanation: "Your request was approved. You can now sign in with the email and password you used to request access.",
  },
  REJECTED: {
    tone: "error",
    label: "Not approved",
    explanation: "Your organization admin didn't approve this request.",
  },
};

// Deliberately reads SecureStore fresh on every mount rather than trusting
// in-memory state from JoinOrganizationScreen — this screen is also the
// one an app restart lands on, per the manual QA checklist.
export function RequestStatusScreen({ navigation }: Props) {
  const loaded = usePendingAccessRequestStore((state) => state.loaded);
  const pending = usePendingAccessRequestStore((state) => state.data);
  const load = usePendingAccessRequestStore((state) => state.load);
  const clear = usePendingAccessRequestStore((state) => state.clear);

  useEffect(() => {
    load();
  }, [load]);

  const statusQuery = useAccessRequestStatus(pending?.requestId, pending?.statusToken);

  async function handleSubmitNew() {
    await clear();
    navigation.replace("JoinOrganization");
  }

  if (!loaded) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!pending) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="help-circle-outline"
          title="No active request"
          message="We couldn't find an active access request on this device."
          actionLabel="Submit a new request"
          onAction={handleSubmitNew}
        />
        <View style={styles.backLink}>
          <AppButton label="Back to sign in" onPress={() => navigation.navigate("Login")} variant="ghost" />
        </View>
      </ScreenContainer>
    );
  }

  if (statusQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Checking request status…" />
      </ScreenContainer>
    );
  }

  if (statusQuery.isError) {
    // Deliberately doesn't distinguish "wrong id," "wrong token," or
    // "otherwise unavailable" — the backend's 404 doesn't either, so this
    // can't claim the request was definitely rejected/deleted.
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't retrieve this request"
          message="We couldn't retrieve this request. You may need to submit a new access request."
          actionLabel="Submit a new request"
          onAction={handleSubmitNew}
        />
        <View style={styles.backLink}>
          <AppButton label="Back to sign in" onPress={() => navigation.navigate("Login")} variant="ghost" />
        </View>
      </ScreenContainer>
    );
  }

  const { status, organizationName } = statusQuery.data;
  const copy = statusCopy[status];

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <AppText variant="screenTitle" style={styles.title}>
          Request status
        </AppText>

        <AppCard style={styles.card}>
          <AppText variant="label">ORGANIZATION</AppText>
          <AppText variant="bodyStrong" style={styles.orgName}>
            {organizationName}
          </AppText>
          <StatusBadge label={copy.label} tone={copy.tone} />
        </AppCard>

        <AppText variant="body" style={styles.explanation}>
          {copy.explanation}
        </AppText>

        {status === "PENDING" ? (
          <AppButton label="Check again" onPress={() => statusQuery.refetch()} loading={statusQuery.isFetching} />
        ) : null}

        {status === "APPROVED" ? (
          <AppButton
            label="Log in now"
            onPress={async () => {
              await clear();
              navigation.navigate("Login");
            }}
          />
        ) : null}

        {status === "REJECTED" ? (
          <AppButton label="Submit a new request" onPress={handleSubmitNew} />
        ) : null}

        <View style={styles.backLink}>
          <AppButton label="Back to sign in" onPress={() => navigation.navigate("Login")} variant="ghost" />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  orgName: {
    marginBottom: spacing.xs,
  },
  explanation: {
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  backLink: {
    marginTop: spacing.md,
  },
});
