import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors, spacing } from "../theme";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}

export function EmptyState({ icon = "file-tray-outline", title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <AppText variant="sectionTitle" style={styles.title}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="bodySmall" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
  message: {
    textAlign: "center",
  },
});
