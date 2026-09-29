import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, touchTarget } from "../theme";

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: "default" | "primary";
}

// Icon-only buttons must carry their own accessibilityLabel — there's no
// visible text for a screen reader to fall back on.
export function IconButton({ icon, onPress, accessibilityLabel, variant = "default" }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={variant === "primary" ? colors.onPrimary : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
