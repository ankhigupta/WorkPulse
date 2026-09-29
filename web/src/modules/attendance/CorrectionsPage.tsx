import { useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, MutedCell, PageHeader, RowActions, Segmented } from "../../components/Layout";
import { StatusBadge, reviewTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { useCorrectionReview, useCorrections } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { AttendanceCorrection, CorrectionStatus } from "../../types/domain";
import { formatDate } from "../../utils/format";
import { useCorrectionContext } from "./useCorrectionContext";

/*
 * Approving a correction is what actually rewrites the underlying
 * attendance record — the backend does that inside one transaction and
 * returns 409 if another admin got there first, so both actions refetch
 * on conflict rather than leaving a stale row on screen.
 */
export function CorrectionsPage() {
  const [tab, setTab] = useState<CorrectionStatus>("PENDING");
  const correctionsQuery = useCorrections({ status: tab });
  const pendingQuery = useCorrections({ status: "PENDING" });
  const approveMutation = useCorrectionReview("approve");
  const rejectMutation = useCorrectionReview("reject");
  const { showToast } = useToast();

  const corrections = correctionsQuery.data ?? [];
  const context = useCorrectionContext(corrections);

  async function review(correctionId: string, action: "approve" | "reject") {
    const mutation = action === "approve" ? approveMutation : rejectMutation;
    try {
      await mutation.mutateAsync(correctionId);
      showToast(action === "approve" ? "Correction approved" : "Correction rejected", "success");
    } catch (error) {
      showToast(errorMessage(error), "error");
      void correctionsQuery.refetch();
    }
  }

  const columns: Column<AttendanceCorrection>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (correction) => {
        const detail = context.byCorrectionId[correction.id];
        return (
          <div>
            <div style={{ fontWeight: 700 }}>{detail?.employeeName ?? "Employee"}</div>
            <MutedCell>{detail?.storeName ?? "—"}</MutedCell>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Attendance date",
      render: (correction) => {
        const detail = context.byCorrectionId[correction.id];
        return <MutedCell>{detail?.date ? formatDate(detail.date) : "—"}</MutedCell>;
      },
    },
    {
      key: "change",
      header: "Requested change",
      render: (correction) => {
        const detail = context.byCorrectionId[correction.id];
        return (
          <MutedCell>
            {detail ? `${detail.currentStatus.toLowerCase()} → ` : ""}
            {correction.proposedStatus.toLowerCase()}
          </MutedCell>
        );
      },
    },
    { key: "reason", header: "Reason", render: (correction) => correction.reason },
    {
      key: "status",
      header: "Status",
      render: (correction) => (
        <StatusBadge
          label={correction.status.charAt(0) + correction.status.slice(1).toLowerCase()}
          tone={reviewTone(correction.status)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (correction) =>
        correction.status === "PENDING" ? (
          <RowActions>
            <Button size="small" onClick={() => void review(correction.id, "reject")}>
              Reject
            </Button>
            <Button size="small" variant="primary" onClick={() => void review(correction.id, "approve")}>
              Approve
            </Button>
          </RowActions>
        ) : (
          <MutedCell>{correction.reviewedAt ? formatDate(correction.reviewedAt) : "—"}</MutedCell>
        ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Time" title="Attendance corrections" />

      <FilterBar>
        <Segmented
          label="Filter by status"
          value={tab}
          onChange={setTab}
          options={[
            { value: "PENDING", label: "Pending", count: pendingQuery.data?.length },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
      </FilterBar>

      {correctionsQuery.isPending ? (
        <LoadingState message="Loading corrections…" />
      ) : correctionsQuery.isError ? (
        <ErrorState
          message={errorMessage(correctionsQuery.error)}
          onRetry={() => void correctionsQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={corrections}
          rowKey={(correction) => correction.id}
          emptyTitle={tab === "PENDING" ? "Nothing to review" : `No ${tab.toLowerCase()} corrections`}
          emptyMessage={
            tab === "PENDING"
              ? "Store managers raise correction requests from the mobile app when attendance needs changing."
              : undefined
          }
        />
      )}
    </>
  );
}
