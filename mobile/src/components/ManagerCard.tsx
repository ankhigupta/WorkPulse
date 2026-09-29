import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppCard } from "./AppCard";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { Divider } from "./Divider";
import { spacing } from "../theme";
import { formatDateOnly } from "../utils/format";
import type { Manager } from "../types/manager";

interface ManagerCardProps {
  manager: Manager;
  storeName?: string;
  onPress: () => void;
}

function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

// Manager has no `name` field at all (confirmed against the schema, not
// assumed) and `user` is never null — a manager's identity is their login
// email, shown honestly as an email rather than dressed up as a "name".
export function ManagerCard({ manager, storeName, onPress }: ManagerCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${manager.user.email}`}>
      <AppCard style={styles.card}>
        <View style={styles.headerRow}>
          <Avatar name={manager.user.email} />
          <View style={styles.headerText}>
            <AppText variant="bodyStrong">{manager.user.email}</AppText>
            <AppText variant="bodySmall">{formatRoleLabel(manager.user.role)}</AppText>
          </View>
          <StatusBadge label={manager.isActive ? "Active" : "Inactive"} tone={manager.isActive ? "success" : "neutral"} />
        </View>

        <Divider />

        <View style={styles.metaRow}>
          {storeName ? (
            <View style={styles.metaItem}>
              <AppText variant="label">STORE</AppText>
              <AppText variant="body">{storeName}</AppText>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <AppText variant="label">JOINED</AppText>
            <AppText variant="body">{formatDateOnly(manager.joinedAt)}</AppText>
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  metaItem: {
    gap: 2,
  },
});
