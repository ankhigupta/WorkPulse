import { Alert, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppCard } from "./AppCard";
import { Avatar } from "./Avatar";
import { Divider } from "./Divider";
import { StatusBadge, type StatusTone } from "./StatusBadge";
import { useApproveCorrection, useRejectCorrection } from "../hooks/useAttendanceCorrections";
import { colors, spacing } from "../theme";
import { formatDateOnly, formatDateTime } from "../utils/format";
import { ApiError } from "../types/api";
import type { AttendanceCorrection, CorrectionStatus } from "../types/attendanceCorrection";
import type { AttendanceStatus } from "../types/attendance";

interface CorrectionCardProps {
  correction: AttendanceCorrection;
  employeeName?: string;
  attendanceDate?: string;
  currentStatus?: AttendanceStatus;
  storeName?: string;
  /** ORGANIZATION_ADMIN only — STORE_MANAGER never gets Approve/Reject. */
  canReview: boolean;
}

const correctionTone: Record<CorrectionStatus, StatusTone> = {
  // "Processing"/info for pending, "Rejected"/error for rejected — reuses
  // the design system's own status-badge palette mapping directly rather
  // than improvising new tones for these two states.
  PENDING: "info",
  APPROVED: "success",
  REJECTED: "error",
};

const attendanceStatusTone: Record<AttendanceStatus, StatusTone> = {
  PRESENT: "success",
  ABSENT: "error",
};

function attendanceStatusLabel(status: AttendanceStatus): string {
  return status === "PRESENT" ? "Present" : "Absent";
}

const correctionStatusLabel: Record<CorrectionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// Owns its own approve/reject mutations so each card's loading/error state
// is independent — approving one PENDING correction in a list of many
// doesn't disable or affect any other card.
export function CorrectionCard({
  correction,
  employeeName,
  attendanceDate,
  currentStatus,
  storeName,
  canReview,
}: CorrectionCardProps) {
  const approveMutation = useApproveCorrection();
  const rejectMutation = useRejectCorrection();

  const busy = approveMutation.isPending || rejectMutation.isPending;
  const activeError = approveMutation.error ?? rejectMutation.error;
  const errorMessage = activeError
    ? activeError instanceof ApiError
      ? activeError.message
      : "Something went wrong. Please try again."
    : null;

  function confirmApprove() {
    Alert.alert("Approve correction?", "This will update the attendance record's status.", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => approveMutation.mutate(correction.id) },
    ]);
  }

  function confirmReject() {
    Alert.alert("Reject correction?", "The attendance record will remain unchanged.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectMutation.mutate(correction.id) },
    ]);
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <Avatar name={employeeName ?? "?"} />
        <View style={styles.headerText}>
          <AppText variant="bodyStrong">{employeeName ?? "Attendance record"}</AppText>
          {attendanceDate ? (
            <AppText variant="bodySmall">
              {formatDateOnly(attendanceDate)}
              {storeName ? ` · ${storeName}` : ""}
            </AppText>
          ) : null}
        </View>
        <StatusBadge label={correctionStatusLabel[correction.status]} tone={correctionTone[correction.status]} />
      </View>

      <Divider />

      <View style={styles.statusChangeRow}>
        {currentStatus ? (
          <StatusBadge label={attendanceStatusLabel(currentStatus)} tone={attendanceStatusTone[currentStatus]} />
        ) : (
          <AppText variant="bodySmall">Current status unknown</AppText>
        )}
        <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
        <StatusBadge
          label={attendanceStatusLabel(correction.proposedStatus)}
          tone={attendanceStatusTone[correction.proposedStatus]}
        />
      </View>

      <AppText variant="bodySmall" style={styles.reason}>
        {correction.reason}
      </AppText>

      <AppText variant="caption" style={styles.timestamp}>
        Requested {formatDateTime(correction.createdAt)}
        {correction.status !== "PENDING" && correction.reviewedAt ? ` · Reviewed ${formatDateTime(correction.reviewedAt)}` : ""}
      </AppText>

      {errorMessage ? (
        <AppText variant="bodySmall" style={styles.errorText}>
          {errorMessage}
        </AppText>
      ) : null}

      {canReview && correction.status === "PENDING" ? (
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <AppButton label="Reject" variant="destructive" onPress={confirmReject} loading={rejectMutation.isPending} disabled={busy} />
          </View>
          <View style={styles.actionButton}>
            <AppButton label="Approve" onPress={confirmApprove} loading={approveMutation.isPending} disabled={busy} />
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  statusChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reason: {
    color: colors.textSecondary,
  },
  timestamp: {
    marginTop: -spacing.xs,
  },
  errorText: {
    color: colors.error,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
});
