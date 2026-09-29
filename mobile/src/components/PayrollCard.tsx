import { Alert, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppCard } from "./AppCard";
import { Avatar } from "./Avatar";
import { Divider } from "./Divider";
import { StatusBadge } from "./StatusBadge";
import { useFinalizePayroll, useRecalculatePayroll } from "../hooks/usePayroll";
import { colors, spacing } from "../theme";
import { formatCurrency, formatDateTime, formatPeriodLabel } from "../utils/format";
import { ApiError } from "../types/api";
import type { Payroll } from "../types/payroll";

interface PayrollCardProps {
  payroll: Payroll;
  employeeName?: string;
  storeName?: string;
}

// Owns its own recalculate/finalize mutations — same pattern as
// CorrectionCard, for the same reason: one card's in-flight action never
// disables or affects any other card in the list.
export function PayrollCard({ payroll, employeeName, storeName }: PayrollCardProps) {
  const recalculateMutation = useRecalculatePayroll();
  const finalizeMutation = useFinalizePayroll();

  const isDraft = payroll.status === "DRAFT";
  const busy = recalculateMutation.isPending || finalizeMutation.isPending;
  const activeError = recalculateMutation.error ?? finalizeMutation.error;
  const errorMessage = activeError
    ? activeError instanceof ApiError
      ? activeError.message
      : "Something went wrong. Please try again."
    : null;

  function confirmFinalize() {
    Alert.alert(
      "Finalize this payroll?",
      "Finalized payroll is locked — it can no longer be recalculated or changed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Finalize", onPress: () => finalizeMutation.mutate(payroll.id) },
      ],
    );
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <Avatar name={employeeName ?? "?"} />
        <View style={styles.headerText}>
          <AppText variant="bodyStrong">{employeeName ?? "Unknown employee"}</AppText>
          <AppText variant="bodySmall">
            {formatPeriodLabel(payroll.periodStart, payroll.periodEnd)}
            {storeName ? ` · ${storeName}` : ""}
          </AppText>
        </View>
        <StatusBadge label={isDraft ? "Draft" : "Finalized"} tone={isDraft ? "warning" : "success"} />
      </View>

      <Divider />

      <View style={styles.wageRow}>
        <View>
          <AppText variant="label">TOTAL WAGE</AppText>
          <AppText variant="sectionTitle">{formatCurrency(payroll.totalWage)}</AppText>
        </View>
        <AppText variant="bodySmall" style={styles.daysPresent}>
          {payroll.totalDaysPresent} {payroll.totalDaysPresent === 1 ? "day" : "days"} present
        </AppText>
      </View>

      {!isDraft && payroll.finalizedAt ? (
        <AppText variant="caption" style={styles.timestamp}>
          Finalized {formatDateTime(payroll.finalizedAt)}
        </AppText>
      ) : null}

      {errorMessage ? (
        <AppText variant="bodySmall" style={styles.errorText}>
          {errorMessage}
        </AppText>
      ) : null}

      {isDraft ? (
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <AppButton
              label="Recalculate"
              variant="secondary"
              onPress={() => recalculateMutation.mutate(payroll.id)}
              loading={recalculateMutation.isPending}
              disabled={busy}
            />
          </View>
          <View style={styles.actionButton}>
            <AppButton label="Finalize" onPress={confirmFinalize} loading={finalizeMutation.isPending} disabled={busy} />
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
  wageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  daysPresent: {
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
