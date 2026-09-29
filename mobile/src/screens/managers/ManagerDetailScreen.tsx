import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppText, Avatar, Divider, EmptyState, LoadingState, ScreenContainer, StatusBadge } from "../../components";
import { useManager } from "../../hooks/useManagers";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { formatDateOnly } from "../../utils/format";
import { spacing } from "../../theme";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "ManagerDetail">;

// Only ever reached by ORGANIZATION_ADMIN (see ManagerListScreen) — Edit is
// always shown unconditionally here, unlike EmployeeDetailScreen which
// also renders for STORE_MANAGER and gates Edit behind an isAdmin check.
export function ManagerDetailScreen({ route, navigation }: Props) {
  const { managerId } = route.params;

  const managerQuery = useManager(managerId);
  const storeQuery = useStoreList();

  if (managerQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading manager…" />
      </ScreenContainer>
    );
  }

  if (managerQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this manager"
          message={managerQuery.error instanceof ApiError ? managerQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => managerQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const manager = managerQuery.data;
  const storeName = storeQuery.data?.find((s) => s.id === manager.storeId)?.name;

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Avatar name={manager.user.email} size={56} />
        <View style={styles.headerText}>
          <AppText variant="screenTitle">{manager.user.email}</AppText>
          <StatusBadge label={manager.isActive ? "Active" : "Inactive"} tone={manager.isActive ? "success" : "neutral"} />
        </View>
      </View>

      <AppCard style={styles.card}>
        <View style={styles.row}>
          <AppText variant="label">STORE</AppText>
          <AppText variant="body">{storeName ?? "Unknown store"}</AppText>
        </View>
        <Divider />
        <View style={styles.row}>
          <AppText variant="label">JOINED</AppText>
          <AppText variant="body">{formatDateOnly(manager.joinedAt)}</AppText>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <AppText variant="label" style={styles.sectionLabel}>
          LOGIN ACCOUNT
        </AppText>
        <AppText variant="body">{manager.user.email}</AppText>
        <AppText variant="bodySmall" style={styles.mutedText}>
          {manager.user.isActive ? "Account active" : "Account disabled"}
        </AppText>
      </AppCard>

      <AppButton
        label="Edit manager"
        variant="secondary"
        onPress={() => navigation.navigate("ManagerEdit", { managerId })}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  card: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  mutedText: {
    marginTop: spacing.xs,
  },
});
