import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppCard, AppText, ScreenContainer, SectionHeader } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { colors, spacing } from "../../theme";
import type { MoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<MoreStackParamList, "MoreHome">;

type MenuKey = keyof Omit<MoreStackParamList, "MoreHome" | "StoreEdit">;

interface MenuEntry {
  key: MenuKey;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const reportEntries: MenuEntry[] = [
  { key: "AttendanceReport", title: "Attendance", description: "Present/absent totals by employee over a date range", icon: "time-outline" },
  { key: "PayrollReport", title: "Payroll", description: "Payroll records and totals by period and status", icon: "card-outline" },
  { key: "PaymentsReport", title: "Payments", description: "Recorded payments over a date range", icon: "wallet-outline" },
  { key: "WorkforceReport", title: "Workforce", description: "Current employee headcount and roster", icon: "people-outline" },
];

const adminEntries: MenuEntry[] = [
  { key: "Organization", title: "Organization", description: "View and rename your organization", icon: "business-outline" },
  { key: "StoreList", title: "Stores", description: "Manage your organization's stores", icon: "storefront-outline" },
];

function MenuRow({ entry, onPress }: { entry: MenuEntry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={entry.title}>
      <AppCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name={entry.icon} size={22} color={colors.primaryLight} />
          </View>
          <View style={styles.textWrap}>
            <AppText variant="bodyStrong">{entry.title}</AppText>
            <AppText variant="bodySmall">{entry.description}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
      </AppCard>
    </Pressable>
  );
}

// Content adapts to the authenticated role, derived directly from the
// existing auth state — no second authorization system. Reports need
// ORGANIZATION_ADMIN or STORE_MANAGER (reports.routes.ts); Organization/
// Stores need ORGANIZATION_ADMIN specifically (organization.routes.ts /
// store.routes.ts). EMPLOYEE and SUPER_ADMIN get neither — both roles are
// outside every one of those routes' allowed roles — and see only Account.
export function MoreHomeScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const canSeeReports = role === "ORGANIZATION_ADMIN" || role === "STORE_MANAGER";
  const isAdmin = role === "ORGANIZATION_ADMIN";

  return (
    <ScreenContainer scroll>
      <AppText variant="screenTitle" style={styles.title}>
        More
      </AppText>

      {canSeeReports ? (
        <>
          <SectionHeader title="Reports" />
          {reportEntries.map((entry) => (
            <MenuRow key={entry.key} entry={entry} onPress={() => navigation.navigate(entry.key)} />
          ))}
        </>
      ) : null}

      {isAdmin ? (
        <>
          <SectionHeader title="Administration" />
          {adminEntries.map((entry) => (
            <MenuRow key={entry.key} entry={entry} onPress={() => navigation.navigate(entry.key)} />
          ))}
        </>
      ) : null}

      <SectionHeader title="Account" />
      <MenuRow
        entry={{ key: "Account", title: "Account", description: "Profile details and sign out", icon: "person-circle-outline" }}
        onPress={() => navigation.navigate("Account")}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
});
