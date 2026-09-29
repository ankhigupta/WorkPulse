import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, AppButton, AppInput, ScreenContainer } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { ApiError } from "../../types/api";
import { EMAIL_PATTERN } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "Work email is required";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }
    if (!password) {
      errors.password = "Password is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <AppText variant="button" style={{ color: colors.primary }}>
              W
            </AppText>
          </View>
          <AppText variant="sectionTitle">WorkPulse</AppText>
        </View>

        <AppText variant="screenTitle" style={styles.title}>
          Welcome back
        </AppText>
        <AppText variant="body" style={styles.subtitle}>
          Sign in to manage your stores, teams and payroll.
        </AppText>

        <AppInput
          label="Work email"
          placeholder="you@company.com"
          value={email}
          onChangeText={setEmail}
          errorMessage={fieldErrors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <AppInput
          label="Password"
          placeholder="••••••••••••"
          value={password}
          onChangeText={setPassword}
          errorMessage={fieldErrors.password}
          secureTextEntry
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {formError ? (
          <AppText variant="bodySmall" style={styles.formError} accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}

        <AppButton label="Sign in" onPress={handleSubmit} loading={loading} />

        <AppText variant="caption" style={styles.footer}>
          Need access? Contact your organization admin.
        </AppText>

        <View style={styles.linksRow}>
          <AppButton label="Create an organization" onPress={() => navigation.navigate("OrgSignup")} variant="ghost" />
          <AppButton label="Join an organization" onPress={() => navigation.navigate("JoinOrganization")} variant="ghost" />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  formError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
  footer: {
    textAlign: "center",
    marginTop: spacing.xl,
  },
  linksRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});
