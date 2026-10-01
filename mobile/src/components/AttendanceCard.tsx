import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppCard } from "./AppCard";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { colors, spacing } from "../theme";
import { formatTime } from "../utils/format";
import type { Attendance } from "../types/attendance";

interface AttendanceCardProps {
  attendance: Attendance;
  employeeName: string;
  storeName?: string;
  /** ORGANIZATION_ADMIN only — opens the direct edit screen. */
  onEdit?: () => void;
  /** STORE_MANAGER only — opens the correction-request screen. */
  onRequestCorrection?: () => void;
  /** A PENDING correction already exists for this record — the card
   *  becomes non-interactive (no new request can be started) and shows
   *  that state instead of either action above. */
  pendingCorrection?: boolean;
}

const methodLabel: Record<Attendance["method"], string> = {
  MANUAL: "Manual",
  QR: "QR",
};

// Absent uses the error tone deliberately — the design system's own
// palette maps "Error / absent" to the same semantic color; it isn't
// borrowed from a generic failure state.
export function AttendanceCard({
  attendance,
  employeeName,
  storeName,
  onEdit,
  onRequestCorrection,
  pendingCorrection = false,
}: AttendanceCardProps) {
  const metaParts = [methodLabel[attendance.method], storeName].filter(Boolean).join(" · ");
  // A pending correction blocks a *new* correction request (that's the
  // "no conflicting duplicate requests" rule) but never blocks an
  // ORGANIZATION_ADMIN's direct edit — admin authority isn't contingent on
  // whatever a manager happens to have pending.
  const onPress = onEdit ?? (pendingCorrection ? undefined : onRequestCorrection);

  const content = (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <Avatar name={employeeName} />
        <View style={styles.info}>
          <AppText variant="bodyStrong">{employeeName}</AppText>
          {metaParts ? (
            <AppText variant="bodySmall" style={styles.meta}>
              {metaParts}
            </AppText>
          ) : null}
        </View>
        <View style={styles.trailing}>
          <StatusBadge
            label={attendance.status === "PRESENT" ? "Present" : "Absent"}
            tone={attendance.status === "PRESENT" ? "success" : "error"}
          />
          {pendingCorrection ? (
            <StatusBadge label="Correction pending" tone="info" />
          ) : attendance.checkInAt ? (
            <AppText variant="caption" style={styles.checkInTime}>
              {formatTime(attendance.checkInAt)}
            </AppText>
          ) : null}
        </View>
      </View>
    </AppCard>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={onEdit ? `Edit attendance for ${employeeName}` : `Request a correction for ${employeeName}`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  meta: {
    color: colors.textSecondary,
  },
  trailing: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  checkInTime: {
    marginTop: 2,
  },
});
