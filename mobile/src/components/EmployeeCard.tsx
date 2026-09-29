import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { AppCard } from "./AppCard";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { Divider } from "./Divider";
import { spacing } from "../theme";
import { formatCurrency } from "../utils/format";
import type { Employee } from "../types/employee";

interface EmployeeCardProps {
  employee: Employee;
  storeName?: string;
  onPress: () => void;
}

// The design reference's list item shows a job title and a per-employee
// attendance-progress line ("Sales Associate", "SEP 22/23") — neither
// exists in the Employee model, and attendance-per-employee would mean an
// N+1 call per row, so both are replaced with real, always-available
// fields: login-account status and, for ORGANIZATION_ADMIN, the store name.
export function EmployeeCard({ employee, storeName, onPress }: EmployeeCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${employee.name}`}>
      <AppCard style={styles.card}>
        <View style={styles.headerRow}>
          <Avatar name={employee.name} />
          <View style={styles.headerText}>
            <AppText variant="bodyStrong">{employee.name}</AppText>
            <AppText variant="bodySmall">{employee.user ? "Login enabled" : "No login account"}</AppText>
          </View>
          <StatusBadge label={employee.isActive ? "Active" : "Inactive"} tone={employee.isActive ? "success" : "neutral"} />
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
            <AppText variant="label">DAILY WAGE</AppText>
            <AppText variant="body">{formatCurrency(employee.dailyWage)}</AppText>
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
