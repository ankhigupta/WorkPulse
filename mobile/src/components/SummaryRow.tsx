import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, spacing } from "../theme";
import type { StatusTone } from "./StatusBadge";

interface SummaryRowProps {
  label: string;
  value: string;
  tone?: StatusTone;
}

const toneDotColor: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.info,
  neutral: colors.textSecondary,
};

// A single label/value line, optionally prefixed with a semantic-color dot —
// reused for attendance present/absent, payroll finalized/draft, and
// payments paid/outstanding. Never uses copper: brand color is reserved for
// primary actions, not status indication (see design system reference).
export function SummaryRow({ label, value, tone }: SummaryRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        {tone ? <View style={[styles.dot, { backgroundColor: toneDotColor[tone] }]} /> : null}
        <AppText variant="bodySmall">{label}</AppText>
      </View>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
