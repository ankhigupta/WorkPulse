import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, spacing } from "../theme";

interface SectionHeaderProps {
  title: string;
  action?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, action, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="sectionTitle">{title}</AppText>
      {action ? (
        <AppText
          variant="bodySmall"
          style={styles.action}
          onPress={onActionPress}
          accessibilityRole="button"
        >
          {action}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  action: {
    color: colors.primaryLight,
  },
});
