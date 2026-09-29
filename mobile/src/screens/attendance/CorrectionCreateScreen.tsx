import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppInput, AppText, ScreenContainer, StatusBadge } from "../../components";
import { useCreateCorrection } from "../../hooks/useAttendanceCorrections";
import { ApiError } from "../../types/api";
import { colors, spacing } from "../../theme";
import { formatDateOnly } from "../../utils/format";
import type { AttendanceStatus } from "../../types/attendance";
import type { AttendanceStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AttendanceStackParamList, "CorrectionCreate">;

const REASON_MAX_LENGTH = 500;

function opposite(status: AttendanceStatus): AttendanceStatus {
  return status === "PRESENT" ? "ABSENT" : "PRESENT";
}

function statusLabel(status: AttendanceStatus): string {
  return status === "PRESENT" ? "Present" : "Absent";
}

// With only two possible attendance statuses, once the current one is
// known there is exactly one meaningful correction to request — the other
// value. A picker here would only ever offer a choice with one valid
// answer, so the requested status is shown as a fact, not asked as a
// question.
export function CorrectionCreateScreen({ route, navigation }: Props) {
  const { attendanceId, employeeName, date, currentStatus } = route.params;
  const proposedStatus = opposite(currentStatus);

  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const createMutation = useCreateCorrection();

  const submitError = createMutation.error
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError("Explain why this record should be corrected");
      return;
    }
    setReasonError(null);

    createMutation.mutate(
      { attendanceId, proposedStatus, reason: trimmed },
      { onSuccess: () => navigation.goBack() },
    );
  }

  return (
    <ScreenContainer scroll>
      <AppCard style={styles.context}>
        <AppText variant="bodyStrong">{employeeName}</AppText>
        <AppText variant="bodySmall">{formatDateOnly(date)}</AppText>

        <View style={styles.statusChangeRow}>
          <StatusBadge label={statusLabel(currentStatus)} tone={currentStatus === "PRESENT" ? "success" : "error"} />
          <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
          <StatusBadge label={statusLabel(proposedStatus)} tone={proposedStatus === "PRESENT" ? "success" : "error"} />
        </View>
      </AppCard>

      <AppInput
        label="Reason"
        value={reason}
        onChangeText={(value) => {
          setReason(value);
          if (reasonError) setReasonError(null);
        }}
        errorMessage={reasonError ?? undefined}
        placeholder="Explain why this record should be corrected"
        multiline
        maxLength={REASON_MAX_LENGTH}
        style={styles.reasonInput}
      />

      {submitError ? (
        <AppText variant="bodySmall" style={styles.errorText}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton label="Submit correction request" onPress={handleSubmit} loading={createMutation.isPending} />

      <AppText variant="caption" style={styles.notice}>
        This request needs organization admin approval before the attendance record changes.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  context: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statusChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reasonInput: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  errorText: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    color: colors.error,
  },
  notice: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
});
