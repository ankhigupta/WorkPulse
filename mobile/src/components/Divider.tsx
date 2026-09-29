import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, spacing } from "../theme";

export function Divider({ style, ...props }: ViewProps) {
  return <View style={[styles.line, style]} {...props} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
