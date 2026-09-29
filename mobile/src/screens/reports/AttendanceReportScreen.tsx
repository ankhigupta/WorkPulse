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
import { useAuthStore } from "../../stores/authStore";
import { useAttendanceReport } from "../../hooks/useReports";
import { useEmployeeList } from "../../hooks/useEmployees";
import { useStoreList } from "../../hooks/useStores";
import { ApiError } from "../../types/api";
import { colors, spacing } from "../../theme";
import { startOfMonth, todayDateOnly } from "../../utils/date";
import { isValidDateOnly } from "../../utils/validation";

const today = todayDateOnly();

export function AttendanceReportScreen() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ORGANIZATION_ADMIN";

  const [startDateInput, setStartDateInput] = useState(startOfMonth(today));
  const [endDateInput, setEndDateInput] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ startDate: startOfMonth(today), endDate: today });
  const [dateErrors, setDateErrors] = useState<{ startDate?: string; endDate?: string }>({});
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [storeId, setStoreId] = useState<string | undefined>(undefined);

  const employeeQuery = useEmployeeList();
  const storeQuery = useStoreList(isAdmin);

  const reportQuery = useAttendanceReport(
    { startDate: appliedRange.startDate, endDate: appliedRange.endDate, employeeId, storeId: isAdmin ? storeId : undefined },
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
              <SummaryRow label="Present" value={String(reportQuery.data.summary.present)} tone="success" />
              <SummaryRow label="Absent" value={String(reportQuery.data.summary.absent)} tone="error" />
              <SummaryRow label="Attendance rate" value={`${reportQuery.data.summary.attendanceRate}%`} />
            </AppCard>
          }
          renderItem={({ item }) => (
            <AppCard style={styles.row}>
              <AppText variant="bodyStrong">{item.employeeName}</AppText>
              <AppText variant="bodySmall" style={styles.meta}>
                {item.storeName}
              </AppText>
              <View style={styles.statsRow}>
                <SummaryRow label="Present" value={String(item.present)} tone="success" />
                <SummaryRow label="Absent" value={String(item.absent)} tone="error" />
                <SummaryRow label="Rate" value={`${item.attendanceRate}%`} />
              </View>
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No attendance in this range"
              message="No attendance records match these filters."
            />
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
  meta: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statsRow: {
    gap: 0,
  },
});
