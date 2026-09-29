import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Switch, View } from "react-native";
import {
  AppCard,
  AppText,
  EmptyState,
  LoadingState,
  ScreenContainer,
  SectionHeader,
  SelectField,
  StatusBadge,
  SummaryRow,
} from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useWorkforceReport } from "../../hooks/useReports";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, spacing } from "../../theme";
import { formatCurrency, formatDateOnly } from "../../utils/format";

// No date range on this report at all (it's a current-state roster, not a
// period-based report) — both filters here are discrete selections, so
// unlike the other three reports there's no text-field "Apply" step;
// every change refetches immediately, same as a list screen's filter chips.
export function WorkforceReportScreen() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const [activeOnly, setActiveOnly] = useState(true);

  const storeQuery = useStoreList(isAdmin);
  const reportQuery = useWorkforceReport({ storeId: isAdmin ? storeId : undefined, activeOnly });

  const storeOptions = (storeQuery.data ?? []).map((s) => ({ id: s.id, label: s.name }));

  return (
    <ScreenContainer>
      {isAdmin ? (
        <SelectField
          label="Store"
          placeholder="Select a store"
          allLabel="All stores"
          options={storeOptions}
          value={storeId}
          onChange={setStoreId}
        />
      ) : null}

      <View style={styles.switchRow}>
        <View>
          <AppText variant="label">ACTIVE ONLY</AppText>
          <AppText variant="caption">Off shows inactive employees too</AppText>
        </View>
        <Switch
          value={activeOnly}
          onValueChange={setActiveOnly}
          trackColor={{ false: colors.border, true: colors.primaryDeep }}
          thumbColor={activeOnly ? colors.primary : colors.textMuted}
          accessibilityLabel="Active employees only"
        />
      </View>

      {reportQuery.isPending ? (
        <LoadingState message="Loading report…" />
      ) : reportQuery.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load report"
          message={reportQuery.error instanceof ApiError ? reportQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => reportQuery.refetch()}
        />
      ) : (
        <FlatList
          data={reportQuery.data.employees}
          keyExtractor={(item) => item.employeeId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={reportQuery.isRefetching} onRefresh={() => reportQuery.refetch()} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <AppCard style={styles.summaryCard}>
              <SectionHeader title="Summary" />
              <SummaryRow label="Total employees" value={String(reportQuery.data.summary.totalEmployees)} />
              <SummaryRow label="Active" value={String(reportQuery.data.summary.activeEmployees)} tone="success" />
              <SummaryRow label="Inactive" value={String(reportQuery.data.summary.inactiveEmployees)} tone="neutral" />
            </AppCard>
          }
          renderItem={({ item }) => (
            <AppCard style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowHeaderText}>
                  <AppText variant="bodyStrong">{item.employeeName}</AppText>
                  <AppText variant="bodySmall" style={styles.meta}>
                    {item.storeName} · Joined {formatDateOnly(item.joinedAt)}
                  </AppText>
                </View>
                <StatusBadge label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "success" : "neutral"} />
              </View>
              <AppText variant="bodySmall" style={styles.wage}>
                {formatCurrency(item.dailyWage)} / day
              </AppText>
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState icon="people-outline" title="No employees match" message="No employees match these filters." />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  summaryCard: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  row: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rowHeaderText: {
    flex: 1,
    gap: 2,
  },
  meta: {
    color: colors.textSecondary,
  },
  wage: {
    marginTop: spacing.xs,
  },
});
