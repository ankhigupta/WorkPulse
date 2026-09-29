import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radii, spacing } from "../theme";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
}

// Per the design system: "Copper never appears in a badge, legend dot or
// status bar" — tones are restricted to the four semantic colors + neutral.
const toneColors: Record<StatusTone, { bg: string; dot: string; text: string }> = {
  success: { bg: "rgba(95, 201, 138, 0.16)", dot: colors.success, text: colors.success },
  warning: { bg: "rgba(233, 191, 79, 0.16)", dot: colors.warning, text: colors.warning },
  error: { bg: "rgba(238, 111, 138, 0.16)", dot: colors.error, text: colors.error },
  info: { bg: "rgba(143, 176, 218, 0.16)", dot: colors.info, text: colors.info },
  neutral: { bg: colors.surfaceElevated, dot: colors.textSecondary, text: colors.textSecondary },
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const { bg, dot, text } = toneColors[tone];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <AppText variant="caption" style={{ color: text }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
