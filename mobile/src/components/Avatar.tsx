import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors } from "../theme";

interface AvatarProps {
  name: string;
  size?: number;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Every Employee has a name but may have no photo (no account, no upload
// flow yet) — initials-on-a-circle is the only avatar this app needs for now.
export function Avatar({ name, size = 40 }: AvatarProps) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <AppText variant="label" style={{ color: colors.textSecondary }}>
        {initialsFor(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
