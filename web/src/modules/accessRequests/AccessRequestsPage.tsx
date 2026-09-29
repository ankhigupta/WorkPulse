import { useState } from "react";
import { Button } from "../../components/Button";
import { DataTable, type Column } from "../../components/DataTable";
import { TextAreaField } from "../../components/Form";
import { Modal } from "../../components/Modal";
import { ErrorState, LoadingState } from "../../components/States";
import { FilterBar, MutedCell, PageHeader, RowActions, Segmented } from "../../components/Layout";
import { StatusBadge, reviewTone } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { useAccessRequests, useRejectAccessRequest } from "../../hooks/queries";
import { errorMessage } from "../../types/api";
import type { AccessRequest, AccessRequestStatus } from "../../types/domain";
import { formatDate, roleLabel } from "../../utils/format";
import { ApproveRequestModal } from "./ApproveRequestModal";
import styles from "./AccessRequests.module.css";

/*
 * Completes the self-service onboarding loop started on mobile: a store
 * manager or employee requests access with a join code, and this is where
 * an organization admin turns that request into a real account.
 *
 * "Requested role" is rendered as a dashed outline badge and never as a
 * filled status badge, so it can't be mistaken for a role the person
 * actually holds. The approved role is chosen in the approval form.
 */
export function AccessRequestsPage() {
  const [tab, setTab] = useState<AccessRequestStatus>("PENDING");
  const requestsQuery = useAccessRequests(tab);
  const pendingQuery = useAccessRequests("PENDING");
  const rejectMutation = useRejectAccessRequest();
  const { showToast } = useToast();

  const [approving, setApproving] = useState<AccessRequest | null>(null);
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function handleReject() {
    if (!rejecting) return;
    try {
      await rejectMutation.mutateAsync({
        requestId: rejecting.id,
        reason: rejectReason.trim() || undefined,
      });
      showToast("Access request rejected", "success");
      setRejecting(null);
      setRejectReason("");
    } catch (error) {
      // 409 means another admin already handled it — refetch so the list
      // reflects reality instead of leaving a stale row on screen.
      showToast(errorMessage(error), "error");
      void requestsQuery.refetch();
      setRejecting(null);
    }
  }

  const columns: Column<AccessRequest>[] = [
    {
      key: "requester",
      header: "Requester",
      render: (request) => (
        <div>
          <div className={styles.requesterEmail}>{request.email}</div>
          <div className={styles.requesterName}>{request.requestedName}</div>
        </div>
      ),
    },
    {
      key: "requestedRole",
      header: "Requested role",
      render: (request) => (
        <StatusBadge label={roleLabel(request.requestedRole)} tone="outline" dot={false} />
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      render: (request) => <MutedCell>{formatDate(request.createdAt)}</MutedCell>,
    },
    {
      key: "status",
      header: "Status",
      render: (request) => (
        <StatusBadge
          label={request.status.charAt(0) + request.status.slice(1).toLowerCase()}
          tone={reviewTone(request.status)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (request) =>
        request.status === "PENDING" ? (
          <RowActions>
            <Button size="small" onClick={() => setRejecting(request)}>
              Reject
            </Button>
            <Button size="small" variant="primary" onClick={() => setApproving(request)}>
              Approve
            </Button>
          </RowActions>
        ) : (
          <MutedCell>{request.reviewedAt ? formatDate(request.reviewedAt) : "—"}</MutedCell>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Access requests"
        actions={
          <Button onClick={() => void requestsQuery.refetch()} loading={requestsQuery.isFetching}>
            Refresh
          </Button>
        }
      />

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

      {requestsQuery.isPending ? (
        <LoadingState message="Loading access requests…" />
      ) : requestsQuery.isError ? (
        <ErrorState message={errorMessage(requestsQuery.error)} onRetry={() => void requestsQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={requestsQuery.data}
          rowKey={(request) => request.id}
          emptyTitle={
            tab === "PENDING" ? "No pending requests" : `No ${tab.toLowerCase()} requests`
          }
          emptyMessage={
            tab === "PENDING"
              ? "New requests appear here when someone signs up with your organization's join code."
              : undefined
          }
        />
      )}

      <ApproveRequestModal request={approving} onClose={() => setApproving(null)} />

      <Modal
        open={Boolean(rejecting)}
        title="Reject access request"
        description="The requester is only told the request wasn't approved — your reason stays internal."
        onClose={() => setRejecting(null)}
        footer={
          <>
            <Button onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" loading={rejectMutation.isPending} onClick={() => void handleReject()}>
              Reject request
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Reason (optional, admin-only)"
          placeholder="Why this request was rejected…"
          value={rejectReason}
          maxLength={500}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
