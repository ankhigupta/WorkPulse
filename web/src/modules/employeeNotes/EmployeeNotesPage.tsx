import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { FormError, SelectField, TextAreaField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, FilterSelect, MutedCell, PageHeader } from "../../components/Layout";
import { useToast } from "../../components/Toast";
import { IconPlus } from "../../app/icons";
import { useCreateEmployeeNote, useEmployeeNotes, useEmployees } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { EmployeeNote } from "../../types/domain";
import { formatDateTime } from "../../utils/format";

// Notes are append-only by design — the API has no update or delete route,
// so this page offers neither.
export function EmployeeNotesPage() {
  const [employeeId, setEmployeeId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const notesQuery = useEmployeeNotes(employeeId === "all" ? undefined : employeeId);
  const employeesQuery = useEmployees();

  const employeeNameById = useMemo(
    () => new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee.name])),
    [employeesQuery.data],
  );

  const columns: Column<EmployeeNote>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (note) => employeeNameById.get(note.employeeId) ?? "Unknown employee",
    },
    { key: "body", header: "Note", render: (note) => note.body },
    {
      key: "created",
      header: "Recorded",
      align: "right",
      render: (note) => <MutedCell>{formatDateTime(note.createdAt)}</MutedCell>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Employee notes"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus />
            Add note
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

      {notesQuery.isPending ? (
        <LoadingState message="Loading notes…" />
      ) : notesQuery.isError ? (
        <ErrorState message={errorMessage(notesQuery.error)} onRetry={() => void notesQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={notesQuery.data}
          rowKey={(note) => note.id}
          emptyTitle="No notes yet"
          emptyMessage="Notes are permanent operational history — they can't be edited or removed once added."
        />
      )}

      <AddNoteModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function AddNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const employeesQuery = useEmployees();
  const createMutation = useCreateEmployeeNote();
  const { showToast } = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    setFormError(null);
    if (!employeeId) {
      setFormError("Select an employee");
      return;
    }
    if (!body.trim()) {
      setFormError("Write a note first");
      return;
    }
    try {
      await createMutation.mutateAsync({ employeeId, body: body.trim() });
      showToast("Note added", "success");
      setBody("");
      setEmployeeId("");
      onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <Modal
      open={open}
      title="Add employee note"
      description="Notes are permanent — they can't be edited or deleted afterwards."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createMutation.isPending} onClick={() => void submit()}>
            Add note
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
      <TextAreaField
        label="Note"
        placeholder="Onboarding or administrative detail…"
        value={body}
        maxLength={2000}
        onChange={(event) => setBody(event.target.value)}
      />
    </Modal>
  );
}
