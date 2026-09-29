import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppText, ScreenContainer, StatusBadge } from "../../components";
import { colors, spacing } from "../../theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "RequestSubmitted">;

// Never shows requestId/statusToken — those already live only in
// SecureStore via pendingAccessRequestStore, set by JoinOrganizationScreen
// right before navigating here.
export function RequestSubmittedScreen({ navigation, route }: Props) {
  const { organizationName } = route.params;

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="paper-plane-outline" size={32} color={colors.primaryLight} />
        </View>

        <AppText variant="screenTitle" style={styles.title}>
          Request submitted
        </AppText>

        <AppCard style={styles.card}>
          <AppText variant="label">ORGANIZATION</AppText>
          <AppText variant="bodyStrong" style={styles.orgName}>
            {organizationName}
          </AppText>
          <StatusBadge label="Pending" tone="warning" />
        </AppCard>

        <AppText variant="body" style={styles.explanation}>
          An organization admin needs to review and approve your request before you can sign in.
        </AppText>

        <AppButton label="Check request status" onPress={() => navigation.replace("RequestStatus")} />
        <View style={styles.secondaryAction}>
          <AppButton label="Return to sign in" onPress={() => navigation.navigate("Login")} variant="secondary" />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
  },
  iconWrap: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  orgName: {
    marginBottom: spacing.xs,
  },
  explanation: {
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  secondaryAction: {
    marginTop: spacing.md,
  },
});
