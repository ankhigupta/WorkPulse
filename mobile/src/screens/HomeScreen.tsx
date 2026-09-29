import { RefreshControl, StyleSheet, View } from "react-native";
import {
  AppText,
  AppButton,
  AppCard,
  Avatar,
  DashboardSection,
  EmptyState,
  LoadingState,
  MetricCard,
  ScreenContainer,
  SummaryRow,
} from "../components";
import { useAuthStore } from "../stores/authStore";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { ApiError } from "../types/api";
import { formatCurrency, formatPeriodLabel } from "../utils/format";
import { colors, spacing } from "../theme";

// Two-segment bar (present vs. absent, out of total) — the backend only
// models PRESENT/ABSENT (no Late/On Leave), so this deliberately has two
// segments, not the four the design reference shows.
function AttendanceBar({ present, absent, total }: { present: number; absent: number; total: number }) {
  if (total === 0) {
    return <View style={styles.attendanceBarTrack} />;
  }
  return (
    <View style={styles.attendanceBarTrack}>
      <View style={[styles.attendanceBarSegment, { flex: present, backgroundColor: colors.success }]} />
      <View style={[styles.attendanceBarSegment, { flex: absent, backgroundColor: colors.error }]} />
    </View>
  );
}

export function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const query = useDashboardSummary();

  if (query.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading your dashboard…" />
      </ScreenContainer>
    );
  }

  if (query.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your dashboard"
          message={query.error instanceof ApiError ? query.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      </ScreenContainer>
    );
  }

  const data = query.data;
  const periodLabel = formatPeriodLabel(data.period.startDate, data.period.endDate);
  const hasDraftPayroll = Number(data.payroll.draftTotal) > 0;
  const hasOutstanding = Number(data.payments.totalOutstanding) > 0;

  return (
    <ScreenContainer
      scroll
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <Avatar name={user?.email ?? "?"} />
        <View style={styles.headerText}>
          <AppText variant="bodySmall">Good morning</AppText>
          <AppText variant="sectionTitle">{data.organization.name}</AppText>
        </View>
      </View>

      <DashboardSection title={`Attendance · ${periodLabel}`}>
        <AppCard>
          <AppText variant="label">PRESENT</AppText>
          <View style={styles.attendanceHeadline}>
            <AppText variant="screenTitle">{data.attendance.present}</AppText>
            <AppText variant="body" style={styles.attendanceHeadlineSuffix}>
              of {data.attendance.total} recorded
            </AppText>
          </View>
          <AttendanceBar
            present={data.attendance.present}
            absent={data.attendance.absent}
            total={data.attendance.total}
          />
          <View style={styles.attendanceStats}>
            <SummaryRow label="Present" value={String(data.attendance.present)} tone="success" />
            <SummaryRow label="Absent" value={String(data.attendance.absent)} tone="error" />
            <SummaryRow label="Attendance rate" value={`${data.attendance.attendanceRate}%`} />
          </View>
        </AppCard>
      </DashboardSection>

      <DashboardSection title="Workforce">
        <View style={styles.metricRow}>
          <MetricCard
            label="TOTAL STAFF"
            value={String(data.employees.total)}
            caption={`${data.employees.active} active`}
            icon="people"
          />
          <MetricCard
            label="STORES"
            value={String(data.stores.total)}
            caption={`${data.stores.active} active`}
            icon="business"
          />
        </View>
      </DashboardSection>

      <DashboardSection title="Payroll">
        <AppCard>
          <AppText variant="label">FINALIZED</AppText>
          <AppText variant="screenTitle" style={styles.payrollHeadline}>
            {formatCurrency(data.payroll.finalizedTotal)}
          </AppText>
          {hasDraftPayroll ? (
            <SummaryRow label="Draft (not yet finalized)" value={formatCurrency(data.payroll.draftTotal)} tone="warning" />
          ) : null}
        </AppCard>
      </DashboardSection>

      <DashboardSection title="Payments">
        <AppCard>
          <SummaryRow label={`Paid · ${periodLabel}`} value={formatCurrency(data.payments.totalPaid)} tone="success" />
          <SummaryRow
            label="Outstanding (all time)"
            value={formatCurrency(data.payments.totalOutstanding)}
            tone={hasOutstanding ? "warning" : "neutral"}
          />
        </AppCard>
      </DashboardSection>

      <AppButton label="Sign out" variant="secondary" onPress={() => logout()} />
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
  },
  attendanceHeadline: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  attendanceHeadlineSuffix: {
    color: colors.textSecondary,
  },
  attendanceBarTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.chartTrack,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  attendanceBarSegment: {
    height: "100%",
  },
  attendanceStats: {
    marginTop: spacing.md,
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  payrollHeadline: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
