import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
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
  SummaryRow,
} from "../../components";
import { usePaymentsReport } from "../../hooks/useReports";
import { useEmployeeList } from "../../hooks/useEmployees";
import { ApiError } from "../../types/api";
import { colors, spacing } from "../../theme";
import { startOfMonth, todayDateOnly } from "../../utils/date";
import { isValidDateOnly } from "../../utils/validation";
import { formatCurrency, formatDateTime } from "../../utils/format";

const today = todayDateOnly();

// No storeId filter exists on GET /api/reports/payments at all (confirmed
// against paymentsReportQuerySchema) — no store picker here, for either
// role, unlike the other three reports.
export function PaymentsReportScreen() {
  const [startDateInput, setStartDateInput] = useState(startOfMonth(today));
  const [endDateInput, setEndDateInput] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ startDate: startOfMonth(today), endDate: today });
  const [dateErrors, setDateErrors] = useState<{ startDate?: string; endDate?: string }>({});
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);

  const employeeQuery = useEmployeeList();

  const reportQuery = usePaymentsReport(
    { startDate: appliedRange.startDate, endDate: appliedRange.endDate, employeeId },
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

      <View style={styles.applyButton}>
        <AppButton label="Apply" variant="secondary" onPress={applyDateRange} />
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
          data={reportQuery.data.payments}
          keyExtractor={(item) => item.paymentId}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={reportQuery.isRefetching} onRefresh={() => reportQuery.refetch()} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <AppCard style={styles.summaryCard}>
              <SectionHeader title="Summary" />
              <SummaryRow label="Total paid" value={formatCurrency(reportQuery.data.summary.totalPaid)} tone="success" />
              <SummaryRow label="Payments" value={String(reportQuery.data.summary.paymentCount)} />
            </AppCard>
          }
          renderItem={({ item }) => (
            <AppCard style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowHeaderText}>
                  <AppText variant="bodyStrong">{item.employeeName}</AppText>
                  <AppText variant="bodySmall" style={styles.meta}>
                    {formatDateTime(item.paidAt)} · {item.storeName}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" style={styles.amount}>
                  {formatCurrency(item.amount)}
                </AppText>
              </View>
              {item.note ? (
                <AppText variant="bodySmall" style={styles.note}>
                  {item.note}
                </AppText>
              ) : null}
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState icon="wallet-outline" title="No payments in this range" message="No payments match these filters." />
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    alignItems: "center",
  },
  rowHeaderText: {
    flex: 1,
    gap: 2,
  },
  meta: {
    color: colors.textSecondary,
  },
  amount: {
    color: colors.success,
  },
  note: {
    color: colors.textSecondary,
  },
});
