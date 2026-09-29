import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { DataTable, type Column } from "../../components/DataTable";
import { FormError, TextAreaField } from "../../components/Form";
import { ConfirmDialog } from "../../components/Modal";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { PageHeader, SplitGrid, Stack } from "../../components/Layout";
import { StatusBadge, activeTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import {
  useCreateEmployeeNote,
  useEmployee,
  useEmployeeBalance,
  useEmployeeNotes,
  usePayments,
  useStores,
  useUpdateEmployee,
} from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { Payment } from "../../types/domain";
import { formatDate, formatDateTime, formatMoneyPrecise } from "../../utils/format";
import { EmployeeFormModal } from "./EmployeeFormModal";
import styles from "./EmployeeDetail.module.css";

export function EmployeeDetailPage() {
  const { employeeId = "" } = useParams();
  const employeeQuery = useEmployee(employeeId);
  const storesQuery = useStores();
  const balanceQuery = useEmployeeBalance(employeeId);
  const paymentsQuery = usePayments({ employeeId });
  const notesQuery = useEmployeeNotes(employeeId);
  const updateMutation = useUpdateEmployee(employeeId);
  const createNote = useCreateEmployeeNote();
  const { showToast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  if (employeeQuery.isPending) return <LoadingState message="Loading employee…" />;
  if (employeeQuery.isError) {
    return <ErrorState message={errorMessage(employeeQuery.error)} onRetry={() => void employeeQuery.refetch()} />;
  }

  const employee = employeeQuery.data;
  const storeName = (storesQuery.data ?? []).find((store) => store.id === employee.storeId)?.name ?? "—";

  const paymentColumns: Column<Payment>[] = [
    { key: "paidAt", header: "Paid", render: (payment) => formatDate(payment.paidAt) },
    { key: "note", header: "Note", render: (payment) => payment.note ?? "—" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (payment) => formatMoneyPrecise(payment.amount),
    },
  ];

  async function handleToggleActive() {
    try {
      await updateMutation.mutateAsync({ isActive: !employee.isActive });
      showToast(employee.isActive ? "Employee deactivated" : "Employee reactivated", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setConfirmDeactivate(false);
    }
  }

  async function handleAddNote() {
    setNoteError(null);
    const body = noteBody.trim();
    if (!body) {
      setNoteError("Write a note first");
      return;
    }
    try {
      await createNote.mutateAsync({ employeeId, body });
      setNoteBody("");
      showToast("Note added", "success");
    } catch (error) {
      setNoteError(errorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workforce"
        title={employee.name}
        actions={
          <>
            <Link to="/employees">
              <Button>Back to employees</Button>
            </Link>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            <Button
              variant={employee.isActive ? "destructive" : "primary"}
              onClick={() => setConfirmDeactivate(true)}
            >
              {employee.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        }
      />

      <SplitGrid>
        <Card>
          <CardHeader title="Details" />
          <dl className={styles.details}>
            <div className={styles.detailRow}>
              <dt>Status</dt>
              <dd>
                <StatusBadge
                  label={employee.isActive ? "Active" : "Inactive"}
                  tone={activeTone(employee.isActive)}
                />
              </dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Store</dt>
              <dd>{storeName}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Daily wage</dt>
              <dd>{formatMoneyPrecise(employee.dailyWage)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Joined</dt>
              <dd>{formatDate(employee.joinedAt)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Login account</dt>
              <dd>
                {employee.user ? (
                  employee.user.email
                ) : (
                  <span className={styles.muted}>None — attendance is marked by a manager</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Balance" subtitle="Finalized payroll against payments recorded" />
          {balanceQuery.isPending ? (
            <LoadingState />
          ) : balanceQuery.isError ? (
            <ErrorState message={errorMessage(balanceQuery.error)} />
          ) : (
            <dl className={styles.details}>
              <div className={styles.detailRow}>
                <dt>Finalized wage</dt>
                <dd>{formatMoneyPrecise(balanceQuery.data.totalOwed)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Paid</dt>
                <dd>{formatMoneyPrecise(balanceQuery.data.totalPaid)}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Outstanding</dt>
                <dd className={styles.emphasis}>{formatMoneyPrecise(balanceQuery.data.outstanding)}</dd>
              </div>
            </dl>
          )}
        </Card>
      </SplitGrid>

      <SplitGrid>
        <Card flush>
          <div className={styles.cardPadding}>
            <CardHeader title="Payments" subtitle="Money recorded against this employee" />
          </div>
          {paymentsQuery.isPending ? (
            <LoadingState />
          ) : (
            <DataTable
              columns={paymentColumns}
              rows={paymentsQuery.data ?? []}
              rowKey={(payment) => payment.id}
              emptyTitle="No payments yet"
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Notes" subtitle="Append-only operational history" />
          <TextAreaField
            label="Add a note"
            placeholder="Onboarding or administrative detail…"
            value={noteBody}
            error={noteError ?? undefined}
            onChange={(event) => setNoteBody(event.target.value)}
            maxLength={2000}
          />
          {createNote.isError ? <FormError message={errorMessage(createNote.error)} /> : null}
          <Button variant="primary" loading={createNote.isPending} onClick={() => void handleAddNote()}>
            Add note
          </Button>

          <div className={styles.notes}>
            {notesQuery.isPending ? (
              <LoadingState />
            ) : (notesQuery.data ?? []).length === 0 ? (
              <EmptyState title="No notes yet" />
            ) : (
              <Stack>
                {(notesQuery.data ?? []).map((note) => (
                  <div key={note.id} className={styles.note}>
                    <p>{note.body}</p>
                    <span className={styles.noteMeta}>{formatDateTime(note.createdAt)}</span>
                  </div>
                ))}
              </Stack>
            )}
          </div>
        </Card>
      </SplitGrid>

      <EmployeeFormModal open={editOpen} onClose={() => setEditOpen(false)} employee={employee} />

      <ConfirmDialog
        open={confirmDeactivate}
        title={employee.isActive ? "Deactivate employee?" : "Reactivate employee?"}
        message={
          employee.isActive
            ? "They stay in your records and keep all attendance, payroll and payment history. They just won't count as active."
            : "They will count as an active employee again."
        }
        confirmLabel={employee.isActive ? "Deactivate" : "Reactivate"}
        destructive={employee.isActive}
        loading={updateMutation.isPending}
        onConfirm={() => void handleToggleActive()}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </>
  );
}
