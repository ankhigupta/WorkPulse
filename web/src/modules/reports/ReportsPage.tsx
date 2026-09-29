import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { DataTable, type Column } from "../../components/DataTable";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, FilterSelect, MutedCell, NumericCell, PageHeader, StatGrid } from "../../components/Layout";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { TextField } from "../../components/Form";
import { useStores } from "../../hooks/queries";
import {
  getAttendanceReport,
  getPaymentsReport,
  getPayrollReport,
  getWorkforceReport,
} from "../../api/reports";
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "../../types/api";
import { currentMonthRange, formatDate, formatMoneyPrecise, formatNumber, formatPercent } from "../../utils/format";
import styles from "./Reports.module.css";

const REPORT_TABS = [
  { to: "/reports/attendance", label: "Attendance" },
  { to: "/reports/payroll", label: "Payroll" },
  { to: "/reports/payments", label: "Payments" },
  { to: "/reports/workforce", label: "Workforce" },
];

export function ReportsLayout() {
  return (
    <>
      <PageHeader eyebrow="Money" title="Reports" />
      <nav className={styles.tabs}>
        {REPORT_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

function useDateRange() {
  const defaults = currentMonthRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  return { startDate, endDate, setStartDate, setEndDate };
}

function DateRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  children,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <FilterBar>
      <TextField
        label="From"
        type="date"
        value={startDate}
        onChange={(event) => onStartChange(event.target.value)}
        style={{ maxWidth: 200 }}
      />
      <TextField
        label="To"
        type="date"
        value={endDate}
        onChange={(event) => onEndChange(event.target.value)}
        style={{ maxWidth: 200 }}
      />
      {children}
    </FilterBar>
  );
}

export function AttendanceReportPage() {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const [storeId, setStoreId] = useState("all");
  const storesQuery = useStores();

  const params = { startDate, endDate, ...(storeId === "all" ? {} : { storeId }) };
  const reportQuery = useQuery({
    queryKey: ["report", "attendance", params],
    queryFn: () => getAttendanceReport(params),
  });

  type Row = NonNullable<typeof reportQuery.data>["employees"][number];
  const columns: Column<Row>[] = [
    { key: "employee", header: "Employee", render: (row) => row.employeeName },
    { key: "store", header: "Store", render: (row) => <MutedCell>{row.storeName}</MutedCell> },
    { key: "present", header: "Present", align: "right", render: (row) => <NumericCell>{row.present}</NumericCell> },
    { key: "absent", header: "Absent", align: "right", render: (row) => <NumericCell>{row.absent}</NumericCell> },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (row) => <NumericCell>{formatPercent(row.attendanceRate)}</NumericCell>,
    },
  ];

  return (
    <>
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <FilterSelect label="Filter by store" value={storeId} onChange={setStoreId}>
          <option value="all">All stores</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </FilterSelect>
      </DateRangeFilter>

      {reportQuery.isPending ? (
        <LoadingState message="Building report…" />
      ) : reportQuery.isError ? (
        <ErrorState message={errorMessage(reportQuery.error)} onRetry={() => void reportQuery.refetch()} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Present" value={formatNumber(reportQuery.data.summary.present)} tone="success" />
            <StatCard label="Absent" value={formatNumber(reportQuery.data.summary.absent)} tone="error" />
            <StatCard label="Records" value={formatNumber(reportQuery.data.summary.total)} />
            <StatCard label="Attendance rate" value={formatPercent(reportQuery.data.summary.attendanceRate)} />
          </StatGrid>
          <DataTable
            columns={columns}
            rows={reportQuery.data.employees}
            rowKey={(row) => row.employeeId}
            emptyTitle="No attendance in this range"
          />
        </>
      )}
    </>
  );
}

export function PayrollReportPage() {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const [storeId, setStoreId] = useState("all");
  const storesQuery = useStores();

  const params = { startDate, endDate, ...(storeId === "all" ? {} : { storeId }) };
  const reportQuery = useQuery({
    queryKey: ["report", "payroll", params],
    queryFn: () => getPayrollReport(params),
  });

  type Row = NonNullable<typeof reportQuery.data>["payroll"][number];
  const columns: Column<Row>[] = [
    { key: "employee", header: "Employee", render: (row) => row.employeeName },
    { key: "store", header: "Store", render: (row) => <MutedCell>{row.storeName}</MutedCell> },
    {
      key: "period",
      header: "Period",
      render: (row) => (
        <MutedCell>
          {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
        </MutedCell>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge
          label={row.status === "FINALIZED" ? "Finalized" : "Draft"}
          tone={row.status === "FINALIZED" ? "success" : "info"}
        />
      ),
    },
    {
      key: "total",
      header: "Total wage",
      align: "right",
      render: (row) => <NumericCell>{formatMoneyPrecise(row.totalWage)}</NumericCell>,
    },
  ];

  return (
    <>
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate}>
        <FilterSelect label="Filter by store" value={storeId} onChange={setStoreId}>
          <option value="all">All stores</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </FilterSelect>
      </DateRangeFilter>

      {reportQuery.isPending ? (
        <LoadingState message="Building report…" />
      ) : reportQuery.isError ? (
        <ErrorState message={errorMessage(reportQuery.error)} onRetry={() => void reportQuery.refetch()} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Draft total" value={formatMoneyPrecise(reportQuery.data.summary.draftTotal)} />
            <StatCard
              label="Finalized total"
              value={formatMoneyPrecise(reportQuery.data.summary.finalizedTotal)}
              tone="success"
            />
            <StatCard label="Records" value={formatNumber(reportQuery.data.summary.recordCount)} />
          </StatGrid>
          <DataTable
            columns={columns}
            rows={reportQuery.data.payroll}
            rowKey={(row) => row.payrollId}
            emptyTitle="No payroll in this range"
          />
        </>
      )}
    </>
  );
}

export function PaymentsReportPage() {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const params = { startDate, endDate };
  const reportQuery = useQuery({
    queryKey: ["report", "payments", params],
    queryFn: () => getPaymentsReport(params),
  });

  type Row = NonNullable<typeof reportQuery.data>["payments"][number];
  const columns: Column<Row>[] = [
    { key: "employee", header: "Employee", render: (row) => row.employeeName },
    { key: "store", header: "Store", render: (row) => <MutedCell>{row.storeName}</MutedCell> },
    { key: "paidAt", header: "Paid on", render: (row) => <MutedCell>{formatDate(row.paidAt)}</MutedCell> },
    { key: "note", header: "Note", render: (row) => <MutedCell>{row.note ?? "—"}</MutedCell> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <NumericCell>{formatMoneyPrecise(row.amount)}</NumericCell>,
    },
  ];

  return (
    <>
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />

      {reportQuery.isPending ? (
        <LoadingState message="Building report…" />
      ) : reportQuery.isError ? (
        <ErrorState message={errorMessage(reportQuery.error)} onRetry={() => void reportQuery.refetch()} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Total paid" value={formatMoneyPrecise(reportQuery.data.summary.totalPaid)} />
            <StatCard label="Payments" value={formatNumber(reportQuery.data.summary.paymentCount)} />
          </StatGrid>
          <DataTable
            columns={columns}
            rows={reportQuery.data.payments}
            rowKey={(row) => row.paymentId}
            emptyTitle="No payments in this range"
          />
        </>
      )}
    </>
  );
}

export function WorkforceReportPage() {
  const [storeId, setStoreId] = useState("all");
  const [activeOnly, setActiveOnly] = useState("true");
  const storesQuery = useStores();

  const params = { ...(storeId === "all" ? {} : { storeId }), activeOnly: activeOnly === "true" };
  const reportQuery = useQuery({
    queryKey: ["report", "workforce", params],
    queryFn: () => getWorkforceReport(params),
  });

  type Row = NonNullable<typeof reportQuery.data>["employees"][number];
  const columns: Column<Row>[] = [
    { key: "employee", header: "Employee", render: (row) => row.employeeName },
    { key: "store", header: "Store", render: (row) => <MutedCell>{row.storeName}</MutedCell> },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge label={row.isActive ? "Active" : "Inactive"} tone={row.isActive ? "success" : "neutral"} />
      ),
    },
    { key: "joined", header: "Joined", render: (row) => <MutedCell>{formatDate(row.joinedAt)}</MutedCell> },
    {
      key: "wage",
      header: "Daily wage",
      align: "right",
      render: (row) => <NumericCell>{formatMoneyPrecise(row.dailyWage)}</NumericCell>,
    },
  ];

  return (
    <>
      <FilterBar>
        <FilterSelect label="Filter by store" value={storeId} onChange={setStoreId}>
          <option value="all">All stores</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Include" value={activeOnly} onChange={setActiveOnly}>
          <option value="true">Active only</option>
          <option value="false">All employees</option>
        </FilterSelect>
      </FilterBar>

      {reportQuery.isPending ? (
        <LoadingState message="Building report…" />
      ) : reportQuery.isError ? (
        <ErrorState message={errorMessage(reportQuery.error)} onRetry={() => void reportQuery.refetch()} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Total employees" value={formatNumber(reportQuery.data.summary.totalEmployees)} />
            <StatCard
              label="Active"
              value={formatNumber(reportQuery.data.summary.activeEmployees)}
              tone="success"
            />
            <StatCard label="Inactive" value={formatNumber(reportQuery.data.summary.inactiveEmployees)} />
          </StatGrid>
          <DataTable
            columns={columns}
            rows={reportQuery.data.employees}
            rowKey={(row) => row.employeeId}
            emptyTitle="No employees match this filter"
          />
        </>
      )}
    </>
  );
}
