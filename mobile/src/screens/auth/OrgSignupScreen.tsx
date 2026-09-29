import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, AppButton, AppInput, ScreenContainer } from "../../components";
import { useAuthStore } from "../../stores/authStore";
import { ApiError } from "../../types/api";
import { EMAIL_PATTERN } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "OrgSignup">;

// On success, authStore.signupOrganization sets status:"authenticated" —
// RootNavigator swaps to AppNavigator on its own, same as after login.
// This screen never navigates on success; there's nowhere to navigate to,
// the whole navigator tree underneath it changes.
export function OrgSignupScreen({ navigation }: Props) {
  const signupOrganization = useAuthStore((state) => state.signupOrganization);
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ organizationName?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errors: { organizationName?: string; email?: string; password?: string } = {};
    if (!organizationName.trim()) {
      errors.organizationName = "Organization name is required";
    }
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await signupOrganization(organizationName.trim(), email.trim(), password);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <AppText variant="screenTitle" style={styles.title}>
          Create your organization
        </AppText>
        <AppText variant="body" style={styles.subtitle}>
          You will be set up as the organization admin.
        </AppText>

        <AppInput
          label="Organization name"
          placeholder="Acme Retail"
          value={organizationName}
          onChangeText={setOrganizationName}
          errorMessage={fieldErrors.organizationName}
          returnKeyType="next"
        />

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
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          errorMessage={fieldErrors.password}
          secureTextEntry
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {formError ? (
          <AppText variant="bodySmall" style={styles.formError} accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}

        <AppButton label="Create organization" onPress={handleSubmit} loading={loading} />

        <View style={styles.footer}>
          <AppButton label="Back to sign in" onPress={() => navigation.navigate("Login")} variant="ghost" />
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
    marginTop: spacing.lg,
  },
});
