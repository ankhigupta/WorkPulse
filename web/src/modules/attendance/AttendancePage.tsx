import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, FilterSelect, MutedCell, PageHeader, PrimaryCell, RowActions, StatGrid } from "../../components/Layout";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { IconCheck, IconPlus, IconX } from "../../app/icons";
import {
  useAttendance,
  useCreateAttendance,
  useEmployees,
  useStores,
  useUpdateAttendanceStatus,
} from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Attendance, AttendanceStatus } from "../../types/domain";
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
  const [editing, setEditing] = useState<Attendance | null>(null);

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
    {
      key: "actions",
      header: "",
      align: "right",
      // ORGANIZATION_ADMIN has direct authority over attendance — Edit
      // updates this row in place via PATCH. There's no STORE_MANAGER
      // session on web at all, so there's no correction-request action to
      // branch to here; that flow only exists on mobile.
      render: (record) => (
        <RowActions>
          <Button size="small" onClick={() => setEditing(record)}>
            Edit
          </Button>
        </RowActions>
      ),
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
      <EditAttendanceModal
        attendance={editing}
        employeeName={editing ? (employeeNameById.get(editing.employeeId) ?? "Unknown employee") : ""}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function EditAttendanceModal({
  attendance,
  employeeName,
  onClose,
}: {
  attendance: Attendance | null;
  employeeName: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(attendance)}
      title="Edit attendance"
      description="Saved directly — no approval needed for an organization admin edit."
      onClose={onClose}
    >
      {attendance ? (
        // Keyed by id so opening a different row remounts this form with
        // fresh state, instead of carrying over the previous row's
        // in-progress selection.
        <EditAttendanceForm key={attendance.id} attendance={attendance} employeeName={employeeName} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function EditAttendanceForm({
  attendance,
  employeeName,
  onClose,
}: {
  attendance: Attendance;
  employeeName: string;
  onClose: () => void;
}) {
  const updateMutation = useUpdateAttendanceStatus();
  const { showToast } = useToast();
  const [newStatus, setNewStatus] = useState<AttendanceStatus>(attendance.status);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ attendanceId: attendance.id, status: newStatus });
      showToast("Attendance updated", "success");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <>
      {formError ? <FormError message={formError} /> : null}
      <FieldRow>
        <TextField label="Employee" value={employeeName} disabled readOnly />
        <TextField label="Date" value={formatDate(attendance.date)} disabled readOnly />
      </FieldRow>
      <FieldRow>
        <TextField
          label="Current status"
          value={attendance.status === "PRESENT" ? "Present" : "Absent"}
          disabled
          readOnly
        />
        <SelectField
          label="New status"
          value={newStatus}
          onChange={(event) => setNewStatus(event.target.value as AttendanceStatus)}
        >
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
        </SelectField>
      </FieldRow>
      <div style={{ marginTop: "var(--space-xl)" }}>
        <RowActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={updateMutation.isPending}
            disabled={newStatus === attendance.status}
            onClick={() => void submit()}
          >
            Save changes
          </Button>
        </RowActions>
      </div>
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
  const storesQuery = useStores();
  const createMutation = useCreateAttendance();
  const { showToast } = useToast();
  const [storeId, setStoreId] = useState("all");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<"PRESENT" | "ABSENT">("PRESENT");
  const [date, setDate] = useState(defaultDate);
  const [formError, setFormError] = useState<string | null>(null);

  // Purely a client-side filter on the Employee list below it — never
  // sent to the backend (createAttendance has no storeId input field at
  // all; storeId is always derived server-side from the employee's own
  // record), so it can't function as an authorization boundary.
  const visibleEmployees = (employeesQuery.data ?? [])
    .filter((employee) => employee.isActive)
    .filter((employee) => storeId === "all" || employee.storeId === storeId);

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
      <SelectField
        label="Store"
        value={storeId}
        onChange={(event) => {
          const nextStoreId = event.target.value;
          setStoreId(nextStoreId);
          const stillVisible = (employeesQuery.data ?? []).some(
            (employee) => employee.id === employeeId && (nextStoreId === "all" || employee.storeId === nextStoreId),
          );
          if (!stillVisible) setEmployeeId("");
        }}
      >
        <option value="all">All stores</option>
        {(storesQuery.data ?? []).map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
        <option value="">Select an employee</option>
        {visibleEmployees.map((employee) => (
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
