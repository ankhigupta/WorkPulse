import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { colors, radii, spacing, touchTarget } from "../theme";
import { EMAIL_PATTERN, isValidDateOnly } from "../utils/validation";
import type { Store } from "../types/store";
import type { CreateManagerInput, UpdateManagerInput } from "../types/manager";

interface StorePickerFieldProps {
  stores: Store[];
  value: string;
  onChange: (storeId: string) => void;
  errorMessage?: string;
}

// Same self-contained modal-list picker pattern as EmployeeForm's
// StorePickerField — kept as its own local copy rather than shared,
// consistent with this app's established precedent (see the Payroll and
// Payment create screens' equivalent employee pickers).
function StorePickerField({ stores, value, onChange, errorMessage }: StorePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = stores.find((s) => s.id === value);

  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        Store
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Select a store"
        style={[styles.pickerTrigger, errorMessage && styles.pickerTriggerError]}
      >
        <AppText variant="body" style={!selected && styles.placeholder}>
          {selected?.name ?? "Select a store"}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {errorMessage ? (
        <AppText variant="caption" style={styles.errorText}>
          {errorMessage}
        </AppText>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <AppText variant="sectionTitle" style={styles.modalTitle}>
              Select a store
            </AppText>
            <ScrollView>
              {stores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => {
                    onChange(store.id);
                    setOpen(false);
                  }}
                  style={styles.modalRow}
                  accessibilityRole="button"
                >
                  <AppText variant="body">{store.name}</AppText>
                  {store.id === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

interface ManagerFormInitialValues {
  storeId: string;
  joinedAt: string;
  isActive: boolean;
}

type ManagerFormProps =
  | {
      mode: "create";
      stores: Store[];
      initialValues?: undefined;
      submitting: boolean;
      submitError?: string | null;
      onSubmit: (values: CreateManagerInput) => void;
    }
  | {
      mode: "edit";
      stores: Store[];
      initialValues: ManagerFormInitialValues;
      submitting: boolean;
      submitError?: string | null;
      onSubmit: (values: UpdateManagerInput) => void;
    };

const emptyValues: ManagerFormInitialValues = { storeId: "", joinedAt: "", isActive: true };

// Manager has no `name` field and, unlike Employee, always requires a
// login account — email/password are always-required create-only fields,
// never optional, and never editable afterward (the backend has no
// credential-change endpoint for managers, so this form doesn't invent one).
export function ManagerForm({ mode, stores, initialValues, submitting, submitError, onSubmit }: ManagerFormProps) {
  const base = initialValues ?? emptyValues;
  const [storeId, setStoreId] = useState(base.storeId);
  const [joinedAt, setJoinedAt] = useState(base.joinedAt);
  const [isActive, setIsActive] = useState(base.isActive);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): CreateManagerInput | UpdateManagerInput | null {
    const nextErrors: Record<string, string> = {};

    if (!storeId) nextErrors.storeId = "Select a store";
    if (!joinedAt.trim() || !isValidDateOnly(joinedAt.trim())) {
      nextErrors.joinedAt = "Enter a valid date as YYYY-MM-DD";
    }

    if (mode === "create") {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        nextErrors.email = "Email is required";
      } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
        nextErrors.email = "Enter a valid email address";
      }
      if (!password) {
        nextErrors.password = "Password is required";
      } else if (password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    if (mode === "create") {
      const payload: CreateManagerInput = {
        email: email.trim(),
        password,
        storeId,
        joinedAt: joinedAt.trim(),
      };
      return payload;
    }

    const editPayload: UpdateManagerInput = { storeId, joinedAt: joinedAt.trim(), isActive };
    return editPayload;
  }

  function handleSubmit() {
    const payload = validate();
    if (!payload) return;
    // Same TS limitation as EmployeeForm — validate()'s return type is
    // already tied to `mode`, this asserts what TS can't link across the
    // two branches of ManagerFormProps.
    (onSubmit as (values: CreateManagerInput | UpdateManagerInput) => void)(payload);
  }

  return (
    <View>
      {mode === "create" ? (
        <>
          <AppInput
            label="Email"
            placeholder="manager@company.com"
            value={email}
            onChangeText={setEmail}
            errorMessage={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <AppInput
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            errorMessage={errors.password}
            secureTextEntry
          />
        </>
      ) : null}

      <StorePickerField stores={stores} value={storeId} onChange={setStoreId} errorMessage={errors.storeId} />

      <AppInput
        label="Joined on"
        placeholder="YYYY-MM-DD"
        value={joinedAt}
        onChangeText={setJoinedAt}
        errorMessage={errors.joinedAt}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {mode === "edit" ? (
        <View style={styles.switchRow}>
          <View>
            <AppText variant="label">ACTIVE</AppText>
            <AppText variant="caption">Inactive managers are kept, never deleted</AppText>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: colors.border, true: colors.primaryDeep }}
            thumbColor={isActive ? colors.primary : colors.textMuted}
            accessibilityLabel="Manager active status"
          />
        </View>
      ) : null}

      {submitError ? (
        <AppText variant="bodySmall" style={styles.formError}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton label={mode === "create" ? "Create manager" : "Save changes"} onPress={handleSubmit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.xs,
  },
  pickerTrigger: {
    minHeight: touchTarget,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTriggerError: {
    borderColor: colors.error,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  modalTitle: {
    marginBottom: spacing.md,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  formError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
});
