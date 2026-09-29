import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import {
  InlineMeta,
  PageHeader,
  ProgressBar,
  SplitGrid,
  Stack,
  StatGrid,
} from "../../components/Layout";
import { IconCheck, IconClock, IconPeople, IconX } from "../../app/icons";
import { useCorrections, useDashboardSummary } from "../../hooks/queries";
import { useCorrectionContext } from "../attendance/useCorrectionContext";
import { errorMessage } from "../../types/api";
import { formatDate, formatMoney, formatNumber, formatPercent } from "../../utils/format";
import styles from "./Dashboard.module.css";

/*
 * Every figure on this page comes from GET /api/dashboard/summary or
 * GET /api/attendance-corrections. The reference design also shows an
 * on-time/late split, on-leave counts, a seven-day attendance chart, a
 * live indicator, payroll projections with a pay date and cycle headcount,
 * a per-store attendance table, a notifications bell and a recent-activity
 * feed. None of those exist in the API, so none of them are drawn here —
 * the composition and density of the reference are kept, its invented
 * numbers are not.
 */
export function DashboardPage() {
  const summaryQuery = useDashboardSummary();
  const pendingCorrectionsQuery = useCorrections({ status: "PENDING" });
  const recentPending = useMemo(
    () => (pendingCorrectionsQuery.data ?? []).slice(0, 5),
    [pendingCorrectionsQuery.data],
  );
  const context = useCorrectionContext(recentPending);

  if (summaryQuery.isPending) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <LoadingState message="Loading your organization…" />
      </>
    );
  }

  if (summaryQuery.isError) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <ErrorState message={errorMessage(summaryQuery.error)} onRetry={() => void summaryQuery.refetch()} />
      </>
    );
  }

  const summary = summaryQuery.data;
  const { attendance, payroll, payments, employees, stores, managers, period } = summary;

  const paidNumeric = Number(payments.totalPaid);
  const finalizedNumeric = Number(payroll.finalizedTotal);
  const settledPercent = finalizedNumeric > 0 ? (paidNumeric / finalizedNumeric) * 100 : 0;

  return (
    <>
      <PageHeader
        eyebrow={`${formatDate(period.startDate)} – ${formatDate(period.endDate)}`}
        title={summary.organization.name}
        actions={
          <Link to="/employees">
            <Button variant="primary">View employees</Button>
          </Link>
        }
      />

      <StatGrid>
        <StatCard
          label="Total employees"
          value={formatNumber(employees.total)}
          meta={`${formatNumber(employees.active)} active`}
          icon={<IconPeople />}
        />
        <StatCard
          label="Present this period"
          value={formatNumber(attendance.present)}
          meta={`${formatPercent(attendance.attendanceRate)} attendance`}
          icon={<IconCheck />}
          tone="success"
        />
        <StatCard
          label="Absent this period"
          value={formatNumber(attendance.absent)}
          meta={`${formatNumber(attendance.total)} records`}
          icon={<IconX />}
          tone="error"
        />
        <StatCard
          label="Pending corrections"
          value={formatNumber(pendingCorrectionsQuery.data?.length ?? 0)}
          meta="awaiting your review"
          icon={<IconClock />}
          tone="warning"
        />
      </StatGrid>

      <SplitGrid>
        <Card>
          <CardHeader
            title="Attendance"
            subtitle={`Present and absent records for ${formatDate(period.startDate)} – ${formatDate(
              period.endDate,
            )}`}
          />
          <div className={styles.attendanceValue}>
            <span className={styles.bigNumber}>{formatPercent(attendance.attendanceRate)}</span>
            <span className={styles.bigNumberMeta}>
              {formatNumber(attendance.present)} of {formatNumber(attendance.total)} records present
            </span>
          </div>
          <ProgressBar percent={attendance.attendanceRate} tone="success" />
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendPresent}`} />
              Present {formatNumber(attendance.present)}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendAbsent}`} />
              Absent {formatNumber(attendance.absent)}
            </span>
          </div>
        </Card>

        {/* The one copper-bearing card on the screen, per the design system. */}
        <Card variant="hero">
          <CardHeader title="Payroll & payments" subtitle="Finalized wage liability against money paid" />
          <div className={styles.heroValue}>{formatMoney(payroll.finalizedTotal)}</div>
          <div className={styles.heroMeta}>finalized for this period</div>
          <ProgressBar percent={settledPercent} />
          <dl className={styles.definitionList}>
            <div className={styles.definitionRow}>
              <dt>Draft payroll</dt>
              <dd>{formatMoney(payroll.draftTotal)}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>Paid this period</dt>
              <dd>{formatMoney(payments.totalPaid)}</dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>Outstanding (all time)</dt>
              <dd>{formatMoney(payments.totalOutstanding)}</dd>
            </div>
          </dl>
          <Link to="/payroll">
            <Button variant="ivory" fullWidth>
              Review payroll
            </Button>
          </Link>
        </Card>
      </SplitGrid>

      <SplitGrid>
        <Card>
          <CardHeader
            title="Pending corrections"
            subtitle="Attendance changes waiting on your approval"
            action={
              <Link to="/attendance/corrections">
                <Button size="small">View all</Button>
              </Link>
            }
          />
          {pendingCorrectionsQuery.isPending ? (
            <LoadingState />
          ) : recentPending.length === 0 ? (
            <EmptyState title="Nothing to review" message="No attendance corrections are pending." />
          ) : (
            <Stack>
              {recentPending.map((correction) => {
                const detail = context.byCorrectionId[correction.id];
                return (
                  <div key={correction.id} className={styles.correctionRow}>
                    <div>
                      <div className={styles.correctionName}>{detail?.employeeName ?? "Employee"}</div>
                      <div className={styles.correctionMeta}>
                        {detail?.date ? `${formatDate(detail.date)} · ` : ""}
                        {detail?.storeName ? `${detail.storeName} · ` : ""}
                        proposed {correction.proposedStatus.toLowerCase()}
                      </div>
                    </div>
                    <StatusBadge label="Pending" tone="warning" />
                  </div>
                );
              })}
            </Stack>
          )}
        </Card>

        <Card>
          <CardHeader title="Organization" subtitle="Current counts across your tenant" />
          <dl className={styles.definitionList}>
            <div className={styles.definitionRow}>
              <dt>Stores</dt>
              <dd>
                {formatNumber(stores.active)} active
                <span className={styles.definitionMuted}> / {formatNumber(stores.total)} total</span>
              </dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>Employees</dt>
              <dd>
                {formatNumber(employees.active)} active
                <span className={styles.definitionMuted}> / {formatNumber(employees.total)} total</span>
              </dd>
            </div>
            <div className={styles.definitionRow}>
              <dt>Managers</dt>
              <dd>
                {formatNumber(managers.active)} active
                <span className={styles.definitionMuted}> / {formatNumber(managers.total)} total</span>
              </dd>
            </div>
          </dl>
          <InlineMeta>Figures cover {formatDate(period.startDate)} – {formatDate(period.endDate)}</InlineMeta>
        </Card>
      </SplitGrid>
    </>
  );
}
