import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppText, ScreenContainer, StatusBadge } from "../../components";
import { useUpdateAttendanceStatus } from "../../hooks/useAttendance";
import { ApiError } from "../../types/api";
import { colors, radii, spacing, touchTarget } from "../../theme";
import { formatDateOnly } from "../../utils/format";
import type { AttendanceStatus } from "../../types/attendance";
import type { AttendanceStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParamList, "AttendanceEdit">;

function statusLabel(status: AttendanceStatus): string {
  return status === "PRESENT" ? "Present" : "Absent";
}

// ORGANIZATION_ADMIN-only direct edit — updates the existing Attendance
// record in place via PATCH, no AttendanceCorrection involved. STORE_MANAGER
// never reaches this screen; they get CorrectionCreateScreen instead (see
// AttendanceCard's role-conditional onPress in AttendanceListScreen).
export function AttendanceEditScreen({ route, navigation }: Props) {
  const { attendanceId, employeeName, date, currentStatus } = route.params;
  const [newStatus, setNewStatus] = useState<AttendanceStatus>(currentStatus);

  const updateMutation = useUpdateAttendanceStatus(attendanceId);

  const submitError = updateMutation.error
    ? updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  function handleSave() {
    updateMutation.mutate({ status: newStatus }, { onSuccess: () => navigation.goBack() });
  }

  return (
    <ScreenContainer scroll>
      <AppCard style={styles.context}>
        <AppText variant="bodyStrong">{employeeName}</AppText>
        <AppText variant="bodySmall">{formatDateOnly(date)}</AppText>
        <View style={styles.currentRow}>
          <AppText variant="label">CURRENT STATUS</AppText>
          <StatusBadge label={statusLabel(currentStatus)} tone={currentStatus === "PRESENT" ? "success" : "error"} />
        </View>
      </AppCard>

      <AppText variant="label" style={styles.label}>
        New status
      </AppText>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setNewStatus("PRESENT")}
          accessibilityRole="button"
          accessibilityState={{ selected: newStatus === "PRESENT" }}
          style={[styles.toggleOption, newStatus === "PRESENT" && styles.toggleOptionPresentActive]}
        >
          <AppText variant="bodyStrong" style={newStatus === "PRESENT" ? styles.toggleTextActive : styles.toggleText}>
            Present
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setNewStatus("ABSENT")}
          accessibilityRole="button"
          accessibilityState={{ selected: newStatus === "ABSENT" }}
          style={[styles.toggleOption, newStatus === "ABSENT" && styles.toggleOptionAbsentActive]}
        >
          <AppText variant="bodyStrong" style={newStatus === "ABSENT" ? styles.toggleTextActive : styles.toggleText}>
            Absent
          </AppText>
        </Pressable>
      </View>

      {submitError ? (
        <AppText variant="bodySmall" style={styles.errorText}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton
        label="Save changes"
        onPress={handleSave}
        loading={updateMutation.isPending}
        disabled={newStatus === currentStatus}
      />

      <AppText variant="caption" style={styles.notice}>
        Saved directly — no approval needed for an organization admin edit.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  context: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  label: {
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  toggleOption: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  toggleOptionPresentActive: {
    backgroundColor: "rgba(95, 201, 138, 0.16)",
    borderColor: colors.success,
  },
  toggleOptionAbsentActive: {
    backgroundColor: "rgba(238, 111, 138, 0.16)",
    borderColor: colors.error,
  },
  toggleText: {
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.text,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.md,
  },
  notice: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
