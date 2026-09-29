import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, EmptyState, IconButton, LoadingState, PayrollCard, ScreenContainer } from "../../components";
import { usePayrollList } from "../../hooks/usePayroll";
import { useEmployeeList } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import type { PayrollStatus } from "../../types/payroll";
import type { PayrollStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PayrollStackParamList, "PayrollList">;

type TabFilter = "ALL" | PayrollStatus;

const tabs: { key: TabFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "FINALIZED", label: "Finalized" },
];

// Payroll only ever renders for ORGANIZATION_ADMIN — AppNavigator doesn't
// even register this tab for any other role (see ADR-011) — so there's no
// store-scoping branch to consider here the way Attendance/Corrections
// needed one for STORE_MANAGER.
export function PayrollListScreen({ navigation }: Props) {
  const [tab, setTab] = useState<TabFilter>("ALL");

  const payrollQuery = usePayrollList({});
  const employeeQuery = useEmployeeList();
  const storeQuery = useStoreList();

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeeQuery.data ?? []) map.set(employee.id, employee.name);
    return map;
  }, [employeeQuery.data]);

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const store of storeQuery.data ?? []) map.set(store.id, store.name);
    return map;
  }, [storeQuery.data]);

  if (payrollQuery.isPending || employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading payroll…" />
      </ScreenContainer>
    );
  }

  if (payrollQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load payroll"
          message={payrollQuery.error instanceof ApiError ? payrollQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => payrollQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (employeeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load employees"
          message={employeeQuery.error instanceof ApiError ? employeeQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => employeeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const allPayroll = payrollQuery.data;
  const filtered = tab === "ALL" ? allPayroll : allPayroll.filter((p) => p.status === tab);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="screenTitle">Payroll</AppText>
        <View style={styles.headerActions}>
          <IconButton icon="wallet-outline" accessibilityLabel="View payments" onPress={() => navigation.navigate("PaymentsList")} />
          <IconButton
            icon="add"
            variant="primary"
            accessibilityLabel="Create payroll"
            onPress={() => navigation.navigate("PayrollCreate")}
          />
        </View>
      </View>

      <View style={styles.tabRow}>
        {tabs.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <AppText variant="bodySmall" style={tab === key ? styles.tabTextActive : styles.tabText}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={payrollQuery.isRefetching} onRefresh={() => payrollQuery.refetch()} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <PayrollCard
            payroll={item}
            employeeName={employeeNameById.get(item.employeeId)}
            storeName={storeNameById.get(item.storeId)}
          />
        )}
        ListEmptyComponent={
          allPayroll.length === 0 ? (
            <EmptyState
              icon="card-outline"
              title="No payroll records"
              message="Create a payroll record for an employee's pay period to get started."
              actionLabel="Create payroll"
              onAction={() => navigation.navigate("PayrollCreate")}
            />
          ) : (
            <EmptyState icon="card-outline" title={`No ${tab.toLowerCase()} payroll`} />
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primaryLight,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
});
