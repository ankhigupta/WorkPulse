import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { FieldRow, FormError, SelectField, TextField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, FilterSelect, MutedCell, NumericCell, PageHeader } from "../../components/Layout";
import { useToast } from "../../components/Toast";
import { IconPlus } from "../../app/icons";
import { useCreatePayment, useEmployeeBalance, useEmployees, usePayments } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Payment } from "../../types/domain";
import { formatDate, formatMoneyPrecise, todayDateOnly } from "../../utils/format";

export function PaymentsPage() {
  const [employeeId, setEmployeeId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(() => (employeeId === "all" ? {} : { employeeId }), [employeeId]);
  const paymentsQuery = usePayments(filters);
  const employeesQuery = useEmployees();

  const employeeNameById = useMemo(
    () => new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee.name])),
    [employeesQuery.data],
  );

  const columns: Column<Payment>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (payment) => employeeNameById.get(payment.employeeId) ?? "Unknown employee",
    },
    { key: "paidAt", header: "Paid on", render: (payment) => <MutedCell>{formatDate(payment.paidAt)}</MutedCell> },
    { key: "note", header: "Note", render: (payment) => <MutedCell>{payment.note ?? "—"}</MutedCell> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (payment) => <NumericCell>{formatMoneyPrecise(payment.amount)}</NumericCell>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Payments"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Record payment
          </Button>
        }
      />

      <FilterBar>
        <FilterSelect label="Filter by employee" value={employeeId} onChange={setEmployeeId}>
          <option value="all">All employees</option>
          {(employeesQuery.data ?? []).map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {paymentsQuery.isPending ? (
        <LoadingState message="Loading payments…" />
      ) : paymentsQuery.isError ? (
        <ErrorState message={errorMessage(paymentsQuery.error)} onRetry={() => void paymentsQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={paymentsQuery.data}
          rowKey={(payment) => payment.id}
          emptyTitle="No payments recorded"
          emptyMessage="Payments are append-only — once recorded they stay as history."
        />
      )}

      <RecordPaymentModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function RecordPaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const employeesQuery = useEmployees();
  const createMutation = useCreatePayment();
  const { showToast } = useToast();

  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayDateOnly());
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const balanceQuery = useEmployeeBalance(employeeId || undefined);

  async function submit() {
    setFormError(null);
    const numericAmount = Number(amount);
    if (!employeeId) {
      setFormError("Select an employee");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Enter an amount greater than zero");
      return;
    }
    try {
      // paidAt is sent as noon UTC on the chosen calendar date, matching
      // the mobile app's convention (ADR-012), so a payment can't drift to
      // the neighbouring day across timezones.
      await createMutation.mutateAsync({
        employeeId,
        amount: numericAmount,
        paidAt: `${paidAt}T12:00:00.000Z`,
        note: note.trim() || undefined,
      });
      showToast("Payment recorded", "success");
      onClose();
    } catch (error) {
      // The API rejects a payment larger than the outstanding balance —
      // surfaced verbatim rather than pre-empted with client-side math.
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title="Record payment"
      description="Payments can't exceed the employee's outstanding balance, and can't be edited afterwards."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createMutation.isPending} onClick={() => void submit()}>
            Record payment
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
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          hint={
            balanceQuery.data ? `Outstanding: ${formatMoneyPrecise(balanceQuery.data.outstanding)}` : undefined
          }
        />
        <TextField label="Paid on" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
      </FieldRow>

      <TextField
        label="Note (optional)"
        placeholder="Reference or remark"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}
