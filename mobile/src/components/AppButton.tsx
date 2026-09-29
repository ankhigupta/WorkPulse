import { ActivityIndicator, Pressable, StyleSheet, type GestureResponderEvent } from "react-native";
import { AppText } from "./AppText";
import { colors, radii, spacing, touchTarget } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface AppButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

// Matches the design system's Buttons panel: Primary/Secondary/Ghost/
// Destructive/Disabled. "Selected" and "Ivory highlight" are per-screen states
// for future list/nav components, not this generic button.
export function AppButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityLabel,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && variant === "primary" && styles.primaryPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onPrimary : colors.text} />
      ) : (
        <AppText
          variant="button"
          style={[
            textColorFor(variant),
            isDisabled && { color: colors.textMuted },
          ]}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

function textColorFor(variant: Variant) {
  switch (variant) {
    case "primary":
      return { color: colors.onPrimary };
    case "destructive":
      return { color: colors.error };
    case "ghost":
      return { color: colors.primaryLight };
    case "secondary":
    default:
      return { color: colors.text };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: "transparent" },
  destructive: {
    backgroundColor: colors.primaryDeep,
  },
});
