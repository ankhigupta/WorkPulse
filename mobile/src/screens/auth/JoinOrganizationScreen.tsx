import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, AppButton, AppCard, AppInput, ScreenContainer, SelectField, type SelectFieldOption } from "../../components";
import { usePendingAccessRequestStore } from "../../stores/pendingAccessRequestStore";
import { useCreateAccessRequest, useOrganizationLookup } from "../../hooks/useAccessRequests";
import { ApiError } from "../../types/api";
import type { OrganizationLookupResult } from "../../types/organization";
import type { RequestedRole } from "../../types/accessRequest";
import { EMAIL_PATTERN } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "JoinOrganization">;

const roleOptions: SelectFieldOption[] = [
  { id: "EMPLOYEE", label: "Employee" },
  { id: "STORE_MANAGER", label: "Store Manager" },
];

// A single screen with two internal steps rather than two nested routes —
// the ticket asks for a "simple step-based flow," and there's no
// deep-linking or back-stack need that would justify real navigation here.
// Step 1: exchange a join code for the organization's name (confirmation
// only — this never lets the requester pick a store or a final role).
// Step 2: name/email/password/requestedRole → submit the access request.
export function JoinOrganizationScreen({ navigation }: Props) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationLookupResult | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; requestedRole?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const lookupMutation = useOrganizationLookup();
  const createMutation = useCreateAccessRequest();
  const savePendingRequest = usePendingAccessRequestStore((state) => state.save);

  function handleLookup() {
    setCodeError(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError("Enter your organization's join code");
      return;
    }
    lookupMutation.mutate(trimmed, {
      onSuccess: (result) => setOrganization(result),
      onError: (err) => {
        setOrganization(null);
        setCodeError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      },
    });
  }

  function handleChangeCode() {
    setOrganization(null);
    lookupMutation.reset();
  }

  function validateForm(): boolean {
    const errors: typeof fieldErrors = {};
    if (!name.trim()) {
      errors.name = "Name is required";
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
    if (!requestedRole) {
      errors.requestedRole = "Select a role";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    setFormError(null);
    if (!validateForm() || !requestedRole) return;

    createMutation.mutate(
      {
        organizationCode: code.trim(),
        email: email.trim(),
        password,
        name: name.trim(),
        requestedRole,
      },
      {
        onSuccess: async (result) => {
          await savePendingRequest({
            requestId: result.requestId,
            statusToken: result.statusToken,
            organizationName: organization?.name ?? "",
          });
          navigation.replace("RequestSubmitted", { organizationName: organization?.name ?? "" });
        },
        onError: (err) => {
          setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        },
      },
    );
  }

  return (
    <ScreenContainer scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <AppText variant="screenTitle" style={styles.title}>
          Join your organization
        </AppText>
        <AppText variant="body" style={styles.subtitle}>
          {organization
            ? "Tell us a bit about yourself to request access."
            : "Enter the join code your organization admin shared with you."}
        </AppText>

        {!organization ? (
          <>
            <AppInput
              label="Organization code"
              placeholder="e.g. 7K3F9QRTNM"
              value={code}
              onChangeText={setCode}
              errorMessage={codeError ?? undefined}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLookup}
            />
            <AppButton label="Continue" onPress={handleLookup} loading={lookupMutation.isPending} />
          </>
        ) : (
          <>
            <AppCard style={styles.orgCard}>
              <AppText variant="label">ORGANIZATION</AppText>
              <AppText variant="sectionTitle">{organization.name}</AppText>
              <View style={styles.changeCodeRow}>
                <AppButton label="Not your organization? Change code" onPress={handleChangeCode} variant="ghost" />
              </View>
            </AppCard>

            <AppInput
              label="Your name"
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              errorMessage={fieldErrors.name}
              returnKeyType="next"
            />

            <AppInput
              label="Email"
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
              returnKeyType="done"
            />

            <SelectField
              label="Requested role"
              placeholder="Select a role"
              options={roleOptions}
              value={requestedRole}
              onChange={(id) => setRequestedRole(id as RequestedRole | undefined)}
              errorMessage={fieldErrors.requestedRole}
            />
            <AppText variant="caption" style={styles.roleNote}>
              Your organization admin makes the final decision on your role, store and start date.
            </AppText>

            {formError ? (
              <AppText variant="bodySmall" style={styles.formError} accessibilityLiveRegion="polite">
                {formError}
              </AppText>
            ) : null}

            <AppButton label="Submit request" onPress={handleSubmit} loading={createMutation.isPending} />
          </>
        )}

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
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  orgCard: {
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  changeCodeRow: {
    marginTop: spacing.sm,
    alignItems: "flex-start",
  },
  roleNote: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  formError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
