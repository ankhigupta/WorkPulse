import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, spacing } from "../theme";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
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
    gap: spacing.md,
  },
  message: {
    marginTop: spacing.sm,
  },
});
