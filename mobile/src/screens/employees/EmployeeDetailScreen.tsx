import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AppButton,
  AppCard,
  AppText,
  Avatar,
  Divider,
  EmptyState,
  LoadingState,
  ScreenContainer,
  StatusBadge,
} from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useEmployee } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { formatCurrency, formatDateOnly } from "../../utils/format";
import { spacing } from "../../theme";
import type { EmployeesStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<EmployeesStackParamList, "EmployeeDetail">;

export function EmployeeDetailScreen({ route, navigation }: Props) {
  const { employeeId } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const employeeQuery = useEmployee(employeeId);
  const storeQuery = useStoreList(isAdmin);

  if (employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading employee…" />
      </ScreenContainer>
    );
  }

  if (employeeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this employee"
          message={
            employeeQuery.error instanceof ApiError ? employeeQuery.error.message : "Something went wrong. Please try again."
          }
          actionLabel="Retry"
          onAction={() => employeeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const employee = employeeQuery.data;
  const storeName = isAdmin ? storeQuery.data?.find((s) => s.id === employee.storeId)?.name : undefined;

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Avatar name={employee.name} size={56} />
        <View style={styles.headerText}>
          <AppText variant="screenTitle">{employee.name}</AppText>
          <StatusBadge label={employee.isActive ? "Active" : "Inactive"} tone={employee.isActive ? "success" : "neutral"} />
        </View>
      </View>

      <AppCard style={styles.card}>
        <View style={styles.row}>
          <AppText variant="label">STORE</AppText>
          <AppText variant="body">{storeName ?? (isAdmin ? "Unknown store" : "Your store")}</AppText>
        </View>
        <Divider />
        <View style={styles.row}>
          <AppText variant="label">DAILY WAGE</AppText>
          <AppText variant="body">{formatCurrency(employee.dailyWage)}</AppText>
        </View>
        <Divider />
        <View style={styles.row}>
          <AppText variant="label">JOINED</AppText>
          <AppText variant="body">{formatDateOnly(employee.joinedAt)}</AppText>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <AppText variant="label" style={styles.sectionLabel}>
          LOGIN ACCOUNT
        </AppText>
        {employee.user ? (
          <>
            <AppText variant="body">{employee.user.email}</AppText>
            <AppText variant="bodySmall" style={styles.mutedText}>
              {employee.user.isActive ? "Account active" : "Account disabled"}
            </AppText>
          </>
        ) : (
          <AppText variant="bodySmall" style={styles.mutedText}>
            No login account — attendance for this employee is recorded by their store manager.
          </AppText>
        )}
      </AppCard>

      {isAdmin ? (
        <AppButton
          label="Edit employee"
          variant="secondary"
          onPress={() => navigation.navigate("EmployeeEdit", { employeeId })}
        />
      ) : null}
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
