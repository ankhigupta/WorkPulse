import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, FilterSelect, MutedCell, PageHeader, PrimaryCell, StatGrid } from "../../components/Layout";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { IconCheck, IconPlus, IconX } from "../../app/icons";
import { useAttendance, useCreateAttendance, useEmployees, useStores } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Attendance } from "../../types/domain";
import { formatDate, formatNumber, todayDateOnly } from "../../utils/format";

/*
 * Attendance statuses are PRESENT and ABSENT — the only two the backend
 * defines. There is no late, half-day or leave state anywhere in the data
 * model, so none is offered here.
 */
export function AttendancePage() {
  const [date, setDate] = useState(todayDateOnly());
  const [storeId, setStoreId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(
    () => ({ date, ...(storeId === "all" ? {} : { storeId }) }),
    [date, storeId],
  );

  const attendanceQuery = useAttendance(filters);
  const employeesQuery = useEmployees();
  const storesQuery = useStores();

  const employeeNameById = useMemo(
    () => new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee.name])),
    [employeesQuery.data],
  );
  const storeNameById = useMemo(
    () => new Map((storesQuery.data ?? []).map((store) => [store.id, store.name])),
    [storesQuery.data],
  );

  const records = attendanceQuery.data ?? [];
  const present = records.filter((record) => record.status === "PRESENT").length;
  const absent = records.length - present;

  const columns: Column<Attendance>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (record) => {
        const name = employeeNameById.get(record.employeeId) ?? "Unknown employee";
        return <PrimaryCell name={name} title={name} />;
      },
    },
    {
      key: "store",
      header: "Store",
      render: (record) => <MutedCell>{storeNameById.get(record.storeId) ?? "—"}</MutedCell>,
    },
    {
      key: "status",
      header: "Status",
      render: (record) => (
        <StatusBadge
          label={record.status === "PRESENT" ? "Present" : "Absent"}
          tone={record.status === "PRESENT" ? "success" : "error"}
        />
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (record) => <MutedCell>{record.method === "QR" ? "QR scan" : "Manual"}</MutedCell>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      render: (record) => <MutedCell>{formatDate(record.date)}</MutedCell>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Time"
        title="Attendance"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Mark attendance
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Records" value={formatNumber(records.length)} meta={formatDate(date)} />
        <StatCard label="Present" value={formatNumber(present)} icon={<IconCheck />} tone="success" />
        <StatCard label="Absent" value={formatNumber(absent)} icon={<IconX />} tone="error" />
        <StatCard
          label="Attendance rate"
          value={records.length === 0 ? "—" : `${Math.round((present / records.length) * 100)}%`}
        />
      </StatGrid>

      <FilterBar>
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          style={{ maxWidth: 220 }}
        />
        <FilterSelect label="Filter by store" value={storeId} onChange={setStoreId}>
          <option value="all">All stores</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {attendanceQuery.isPending ? (
        <LoadingState message="Loading attendance…" />
      ) : attendanceQuery.isError ? (
        <ErrorState message={errorMessage(attendanceQuery.error)} onRetry={() => void attendanceQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(record) => record.id}
          emptyTitle="No attendance recorded"
          emptyMessage="Nothing has been marked for this date and store yet."
        />
      )}

      <MarkAttendanceModal open={createOpen} onClose={() => setCreateOpen(false)} defaultDate={date} />
    </>
  );
}

function MarkAttendanceModal({
  open,
  onClose,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
}) {
  const employeesQuery = useEmployees();
  const createMutation = useCreateAttendance();
  const { showToast } = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<"PRESENT" | "ABSENT">("PRESENT");
  const [date, setDate] = useState(defaultDate);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    setFormError(null);
    if (!employeeId) {
      setFormError("Select an employee");
      return;
    }
    try {
      // Method is always MANUAL from the web — QR scanning is a mobile
      // capability and there is nothing here to scan with.
      await createMutation.mutateAsync({ employeeId, date, status, method: "MANUAL" });
      showToast("Attendance recorded", "success");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title="Mark attendance"
      description="Recorded as a manual entry. Changing it later needs a correction request."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createMutation.isPending} onClick={() => void submit()}>
            Record
          </Button>
        </>
      }
    >
      {formError ? <FormError message={formError} /> : null}
      <SelectField label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
        <option value="">Select an employee</option>
        {(employeesQuery.data ?? [])
          .filter((employee) => employee.isActive)
          .map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
      </SelectField>
      <FieldRow>
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "PRESENT" | "ABSENT")}
        >
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
        </SelectField>
        <TextField label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </FieldRow>
    </Modal>
  );
}
