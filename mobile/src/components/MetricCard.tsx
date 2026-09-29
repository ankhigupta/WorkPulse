import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppCard } from "./AppCard";
import { colors, spacing } from "../theme";

interface MetricCardProps {
  label: string;
  value: string;
  caption?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

// Generic "big number in a card" pattern — reused for headcount, store
// count, and any other single-metric summary a screen needs.
export function MetricCard({ label, value, caption, icon, style }: MetricCardProps) {
  return (
    <AppCard style={[styles.card, style]}>
      <View style={styles.header}>
        <AppText variant="label">{label}</AppText>
        {icon ? <Ionicons name={icon} size={18} color={colors.primaryLight} /> : null}
      </View>
      <AppText variant="screenTitle" style={styles.value}>
        {value}
      </AppText>
      {caption ? (
        <AppText variant="caption" style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  value: {
    marginTop: spacing.sm,
  },
  caption: {
    marginTop: spacing.xs,
  },
});
