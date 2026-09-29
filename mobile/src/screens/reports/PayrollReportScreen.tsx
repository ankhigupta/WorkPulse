import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import {
  AppButton,
  AppCard,
  AppText,
  DateRangeFilter,
  EmptyState,
  LoadingState,
  ScreenContainer,
  SectionHeader,
  SelectField,
  StatusBadge,
  SummaryRow,
} from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { usePayrollReport } from "../../hooks/useReports";
import { useEmployeeList } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, radii, spacing } from "../../theme";
import { startOfMonth, todayDateOnly } from "../../utils/date";
import { isValidDateOnly } from "../../utils/validation";
import { formatCurrency, formatPeriodLabel } from "../../utils/format";
import type { PayrollReportStatus } from "../../types/report";

const today = todayDateOnly();

type StatusFilter = "ALL" | PayrollReportStatus;
const statusTabs: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "FINALIZED", label: "Finalized" },
];

export function PayrollReportScreen() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const [startDateInput, setStartDateInput] = useState(startOfMonth(today));
  const [endDateInput, setEndDateInput] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ startDate: startOfMonth(today), endDate: today });
  const [dateErrors, setDateErrors] = useState<{ startDate?: string; endDate?: string }>({});
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const employeeQuery = useEmployeeList();
  const storeQuery = useStoreList(isAdmin);

  const reportQuery = usePayrollReport(
    {
      startDate: appliedRange.startDate,
      endDate: appliedRange.endDate,
      employeeId,
      storeId: isAdmin ? storeId : undefined,
      status: status === "ALL" ? undefined : status,
    },
    true,
  );

  function applyDateRange() {
    const nextErrors: { startDate?: string; endDate?: string } = {};
    if (!isValidDateOnly(startDateInput.trim())) nextErrors.startDate = "Enter a valid date as YYYY-MM-DD";
    if (!isValidDateOnly(endDateInput.trim())) nextErrors.endDate = "Enter a valid date as YYYY-MM-DD";
    if (!nextErrors.startDate && !nextErrors.endDate && startDateInput.trim() > endDateInput.trim()) {
      nextErrors.endDate = "End date must be on or after start date";
    }
    setDateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setAppliedRange({ startDate: startDateInput.trim(), endDate: endDateInput.trim() });
  }

  const employeeOptions = (employeeQuery.data ?? []).map((e) => ({ id: e.id, label: e.name }));
  const storeOptions = (storeQuery.data ?? []).map((s) => ({ id: s.id, label: s.name }));

  return (
    <ScreenContainer>
      <DateRangeFilter
        startDate={startDateInput}
        endDate={endDateInput}
        onStartDateChange={setStartDateInput}
        onEndDateChange={setEndDateInput}
        startError={dateErrors.startDate}
        endError={dateErrors.endDate}
      />

      <SelectField
        label="Employee"
        placeholder="Select an employee"
        allLabel="All employees"
        searchable
        options={employeeOptions}
        value={employeeId}
        onChange={setEmployeeId}
      />

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

      <View style={styles.statusRow}>
        {statusTabs.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setStatus(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: status === key }}
            style={[styles.statusChip, status === key && styles.statusChipActive]}
          >
            <AppText variant="bodySmall" style={status === key ? styles.statusChipTextActive : styles.statusChipText}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.applyButton}>
        <AppButton label="Apply date range" variant="secondary" onPress={applyDateRange} />
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
          data={reportQuery.data.payroll}
          keyExtractor={(item) => item.payrollId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={reportQuery.isRefetching} onRefresh={() => reportQuery.refetch()} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <AppCard style={styles.summaryCard}>
              <SectionHeader title="Summary" />
              <SummaryRow label="Draft total" value={formatCurrency(reportQuery.data.summary.draftTotal)} tone="warning" />
              <SummaryRow label="Finalized total" value={formatCurrency(reportQuery.data.summary.finalizedTotal)} tone="success" />
              <SummaryRow label="Records" value={String(reportQuery.data.summary.recordCount)} />
            </AppCard>
          }
          renderItem={({ item }) => (
            <AppCard style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowHeaderText}>
                  <AppText variant="bodyStrong">{item.employeeName}</AppText>
                  <AppText variant="bodySmall" style={styles.meta}>
                    {formatPeriodLabel(item.periodStart, item.periodEnd)} · {item.storeName}
                  </AppText>
                </View>
                <StatusBadge label={item.status === "DRAFT" ? "Draft" : "Finalized"} tone={item.status === "DRAFT" ? "warning" : "success"} />
              </View>
              <AppText variant="sectionTitle" style={styles.wage}>
                {formatCurrency(item.totalWage)}
              </AppText>
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState icon="card-outline" title="No payroll in this range" message="No payroll records match these filters." />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  statusChipText: {
    color: colors.textSecondary,
  },
  statusChipTextActive: {
    color: colors.primaryLight,
  },
  applyButton: {
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
