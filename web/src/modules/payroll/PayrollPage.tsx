import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { ConfirmDialog, Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, FilterSelect, MutedCell, NumericCell, PageHeader, RowActions } from "../../components/Layout";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { IconPlus } from "../../app/icons";
import { useCreatePayroll, useEmployees, usePayroll, usePayrollAction, useStores } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Payroll, PayrollStatus } from "../../types/domain";
import { currentMonthRange, formatDate, formatMoneyPrecise } from "../../utils/format";

/*
 * Wage totals are produced by the backend's payroll calculator from
 * attendance records. The client never recomputes them — it triggers
 * generate/recalculate/finalize and renders whatever comes back.
 */
export function PayrollPage() {
  const [status, setStatus] = useState<"all" | PayrollStatus>("all");
  const [storeId, setStoreId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [finalizing, setFinalizing] = useState<Payroll | null>(null);

  const filters = useMemo(
    () => ({
      ...(status === "all" ? {} : { status }),
      ...(storeId === "all" ? {} : { storeId }),
    }),
    [status, storeId],
  );

  const payrollQuery = usePayroll(filters);
  const employeesQuery = useEmployees();
  const storesQuery = useStores();
  const recalculate = usePayrollAction("recalculate");
  const finalize = usePayrollAction("finalize");
  const { showToast } = useToast();

  const employeeNameById = useMemo(
    () => new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee.name])),
    [employeesQuery.data],
  );
  const storeNameById = useMemo(
    () => new Map((storesQuery.data ?? []).map((store) => [store.id, store.name])),
    [storesQuery.data],
  );

  async function run(action: "recalculate" | "finalize", payrollId: string) {
    const mutation = action === "recalculate" ? recalculate : finalize;
    try {
      await mutation.mutateAsync(payrollId);
      showToast(action === "recalculate" ? "Payroll recalculated" : "Payroll finalized", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
      void payrollQuery.refetch();
    } finally {
      setFinalizing(null);
    }
  }

  const columns: Column<Payroll>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (record) => employeeNameById.get(record.employeeId) ?? "Unknown employee",
    },
    {
      key: "store",
      header: "Store",
      render: (record) => <MutedCell>{storeNameById.get(record.storeId) ?? "—"}</MutedCell>,
    },
    {
      key: "period",
      header: "Period",
      render: (record) => (
        <MutedCell>
          {formatDate(record.periodStart)} – {formatDate(record.periodEnd)}
        </MutedCell>
      ),
    },
    {
      key: "days",
      header: "Days present",
      align: "right",
      render: (record) => <NumericCell>{record.totalDaysPresent}</NumericCell>,
    },
    {
      key: "total",
      header: "Total wage",
      align: "right",
      render: (record) => <NumericCell>{formatMoneyPrecise(record.totalWage)}</NumericCell>,
    },
    {
      key: "status",
      header: "Status",
      render: (record) => (
        <StatusBadge
          label={record.status === "FINALIZED" ? "Finalized" : "Draft"}
          tone={record.status === "FINALIZED" ? "success" : "info"}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (record) =>
        record.status === "DRAFT" ? (
          <RowActions>
            <Button size="small" onClick={() => void run("recalculate", record.id)}>
              Recalculate
            </Button>
            <Button size="small" variant="primary" onClick={() => setFinalizing(record)}>
              Finalize
            </Button>
          </RowActions>
        ) : (
          <MutedCell>{record.finalizedAt ? formatDate(record.finalizedAt) : "—"}</MutedCell>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Payroll"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Generate payroll
          </Button>
        }
      />

      <FilterBar>
        <FilterSelect label="Filter by status" value={status} onChange={(value) => setStatus(value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="FINALIZED">Finalized</option>
        </FilterSelect>
        <FilterSelect label="Filter by store" value={storeId} onChange={setStoreId}>
          <option value="all">All stores</option>
          {(storesQuery.data ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {payrollQuery.isPending ? (
        <LoadingState message="Loading payroll…" />
      ) : payrollQuery.isError ? (
        <ErrorState message={errorMessage(payrollQuery.error)} onRetry={() => void payrollQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={payrollQuery.data}
          rowKey={(record) => record.id}
          emptyTitle="No payroll records"
          emptyMessage="Generate payroll for an employee and period to get started."
        />
      )}

      <GeneratePayrollModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={Boolean(finalizing)}
        title="Finalize payroll?"
        message="Finalized payroll becomes an immutable record and starts counting toward the employee's outstanding balance. It can't be recalculated afterwards."
        confirmLabel="Finalize"
        loading={finalize.isPending}
        onConfirm={() => finalizing && void run("finalize", finalizing.id)}
        onCancel={() => setFinalizing(null)}
      />
    </>
  );
}

function GeneratePayrollModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const employeesQuery = useEmployees();
  const createMutation = useCreatePayroll();
  const { showToast } = useToast();
  const range = currentMonthRange();

  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState(range.startDate);
  const [periodEnd, setPeriodEnd] = useState(range.endDate);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    setFormError(null);
    if (!employeeId) {
      setFormError("Select an employee");
      return;
    }
    try {
      await createMutation.mutateAsync({ employeeId, periodStart, periodEnd });
      showToast("Payroll generated", "success");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title="Generate payroll"
      description="Wages are calculated from attendance for the period you choose."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createMutation.isPending} onClick={() => void submit()}>
            Generate
          </Button>
        </>
      }
    >
      {formError ? <FormError message={formError} /> : null}
      <SelectField label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
        <option value="">Select an employee</option>
        {(employeesQuery.data ?? []).map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name}
          </option>
        ))}
      </SelectField>
      <FieldRow>
        <TextField
          label="Period start"
          type="date"
          value={periodStart}
          onChange={(event) => setPeriodStart(event.target.value)}
        />
        <TextField
          label="Period end"
          type="date"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
        />
      </FieldRow>
    </Modal>
  );
}
