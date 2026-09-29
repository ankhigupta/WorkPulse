import { StyleSheet, View } from "react-native";
import { AppButton, AppCard, AppText, Avatar, Divider, ScreenContainer } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { useOrganization } from "../../hooks/useOrganization";
import { spacing } from "../../theme";

function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

// Shows only real fields GET /api/auth/me actually returns (email, role,
// organizationId) — no display name, phone, avatar, or job title exist on
// User, so none are shown or invented. Organization *name* is an
// enrichment fetched separately, and only attempted for
// ORGANIZATION_ADMIN — GET /organizations/:id 403s for every other role.
export function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isAdmin = user?.role === "ORGANIZATION_ADMIN";

  const organizationQuery = useOrganization(user?.organizationId ?? "", isAdmin && Boolean(user?.organizationId));

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Avatar name={user?.email ?? "?"} size={56} />
        <View style={styles.headerText}>
          <AppText variant="screenTitle">{user?.email}</AppText>
          <AppText variant="bodySmall">{user ? formatRoleLabel(user.role) : ""}</AppText>
        </View>
      </View>

      <AppCard style={styles.card}>
        <View style={styles.row}>
          <AppText variant="label">EMAIL</AppText>
          <AppText variant="body">{user?.email}</AppText>
        </View>
        <Divider />
        <View style={styles.row}>
          <AppText variant="label">ROLE</AppText>
          <AppText variant="body">{user ? formatRoleLabel(user.role) : ""}</AppText>
        </View>
        {isAdmin && organizationQuery.data ? (
          <>
            <Divider />
            <View style={styles.row}>
              <AppText variant="label">ORGANIZATION</AppText>
              <AppText variant="body">{organizationQuery.data.name}</AppText>
            </View>
          </>
        ) : null}
      </AppCard>

      <AppButton label="Sign out" variant="secondary" onPress={() => logout()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  card: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
});
