import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { ErrorState, LoadingState } from "../../components/States";
import {
  FilterBar,
  FilterSelect,
  MutedCell,
  NumericCell,
  PageHeader,
  Pagination,
  PrimaryCell,
  RowActions,
  SearchField,
  Segmented,
} from "../../components/Layout";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { IconPlus } from "../../app/icons";
import { useEmployees, useStores } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Employee } from "../../types/domain";
import { formatDate, formatMoneyPrecise, formatNumber } from "../../utils/format";
import { EmployeeFormModal } from "./EmployeeFormModal";

const PAGE_SIZE = 12;

// Stable identity so the memos below don't recompute on every render while
// the query is still loading.
const NO_EMPLOYEES: Employee[] = [];

type StatusFilter = "all" | "active" | "inactive";

/*
 * Follows the Employees reference layout: header + primary action, search,
 * store filter, status segmented control, dense table, initials avatars,
 * status badges, pagination.
 *
 * Columns the reference shows that WorkPulse has no data for are absent
 * rather than faked: there is no employee code (only an internal UUID), no
 * job title, no "on leave" state (isActive is a boolean), no per-month
 * attendance column on this endpoint, and no export API.
 *
 * GET /api/employees returns the whole organization unpaginated and
 * unfiltered, so search, filtering and pagination are all applied on the
 * client over the cached list.
 */
export function EmployeesPage() {
  const employeesQuery = useEmployees();
  const storesQuery = useStores();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const storeNameById = useMemo(
    () => new Map((storesQuery.data ?? []).map((store) => [store.id, store.name])),
    [storesQuery.data],
  );

  const employees = employeesQuery.data ?? NO_EMPLOYEES;

  const counts = useMemo(
    () => ({
      all: employees.length,
      active: employees.filter((employee) => employee.isActive).length,
      inactive: employees.filter((employee) => !employee.isActive).length,
    }),
    [employees],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (storeId !== "all" && employee.storeId !== storeId) return false;
      if (status === "active" && !employee.isActive) return false;
      if (status === "inactive" && employee.isActive) return false;
      if (!term) return true;
      return (
        employee.name.toLowerCase().includes(term) ||
        (employee.user?.email.toLowerCase().includes(term) ?? false)
      );
    });
  }, [employees, search, storeId, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: Column<Employee>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (employee) => (
        <PrimaryCell
          name={employee.name}
          title={employee.name}
          subtitle={employee.user?.email ?? "No login account"}
        />
      ),
    },
    {
      key: "store",
      header: "Store",
      render: (employee) => <MutedCell>{storeNameById.get(employee.storeId) ?? "—"}</MutedCell>,
    },
    {
      key: "status",
      header: "Status",
      render: (employee) => (
        <StatusBadge label={employee.isActive ? "Active" : "Inactive"} tone={activeTone(employee.isActive)} />
      ),
    },
    {
      key: "wage",
      header: "Daily wage",
      align: "right",
      render: (employee) => <NumericCell>{formatMoneyPrecise(employee.dailyWage)}</NumericCell>,
    },
    {
      key: "joined",
      header: "Joined",
      align: "right",
      render: (employee) => (
        <NumericCell>
          <MutedCell>{formatDate(employee.joinedAt)}</MutedCell>
        </NumericCell>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (employee) => (
        <RowActions>
          <Link to={`/employees/${employee.id}`} onClick={(event) => event.stopPropagation()}>
            <Button size="small">View</Button>
          </Link>
        </RowActions>
      ),
    },
  ];

  if (employeesQuery.isPending) {
    return (
      <>
        <PageHeader eyebrow="Workforce" title="Employees" />
        <LoadingState message="Loading employees…" />
      </>
    );
  }

  if (employeesQuery.isError) {
    return (
      <>
        <PageHeader eyebrow="Workforce" title="Employees" />
        <ErrorState message={errorMessage(employeesQuery.error)} onRetry={() => void employeesQuery.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workforce"
        title="Employees"
        actions={
          <>
            <Link to="/managers">
              <Button>Managers</Button>
            </Link>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus />
              Add employee
            </Button>
          </>
        }
      />

      <FilterBar>
        <SearchField
          label="Search employees"
          placeholder="Search by name or email"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Filter by store"
          value={storeId}
          onChange={(value) => {
            setStoreId(value);
            setPage(1);
          }}
        >
          <option value="all">All stores</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </FilterSelect>
        <Segmented
          label="Filter by status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Active", count: counts.active },
            { value: "inactive", label: "Inactive", count: counts.inactive },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(employee) => employee.id}
        onRowClick={(employee) => navigate(`/employees/${employee.id}`)}
        emptyTitle="No employees match these filters"
        emptyMessage="Try a different search, store or status."
        footer={
          <>
            <span>
              Showing {visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
              {(currentPage - 1) * PAGE_SIZE + visible.length} of {formatNumber(filtered.length)} employees
            </span>
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
          </>
        }
      />

      <EmployeeFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
