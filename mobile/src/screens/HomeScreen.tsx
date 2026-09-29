import { StyleSheet, View } from "react-native";
import { AppText, AppButton, AppCard, ScreenContainer } from "../components";
import { useAuthStore } from "../stores/authStore";
import { spacing } from "../theme";

// Foundation-milestone placeholder: proves the authenticated stack, the
// hydrated user, and logout all work end-to-end. The real dashboard
// (GET /api/dashboard/summary) is a separate milestone.
export function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <ScreenContainer>
      <AppText variant="screenTitle">Good morning</AppText>
      <AppText variant="body" style={styles.email}>
        {user?.email}
      </AppText>

      <AppCard style={styles.card}>
        <AppText variant="label">ROLE</AppText>
        <AppText variant="bodyStrong">{user?.role}</AppText>
      </AppCard>

      <View style={styles.spacer} />

      <AppButton label="Sign out" variant="secondary" onPress={() => logout()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  email: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  card: {
    gap: spacing.xs,
  },
  spacer: {
    flex: 1,
  },
});
