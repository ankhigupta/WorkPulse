import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radii, spacing } from "../theme";

interface AppCardProps extends ViewProps {
  elevated?: boolean;
}

export function AppCard({ elevated = false, style, children, ...props }: AppCardProps) {
  return (
    <View style={[styles.base, elevated && styles.elevated, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
});
