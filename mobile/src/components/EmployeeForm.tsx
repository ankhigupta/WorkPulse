import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { Divider } from "./Divider";
import { colors, radii, spacing, touchTarget } from "../theme";
import { EMAIL_PATTERN, isValidDateOnly } from "../utils/validation";
import type { Store } from "../types/store";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../types/employee";

interface StorePickerFieldProps {
  stores: Store[];
  value: string;
  onChange: (storeId: string) => void;
  errorMessage?: string;
}

// A store list is small for WorkPulse's target businesses (a handful of
// stores per organization) — a simple modal list is a better fit than
// pulling in a native picker dependency for this.
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

interface EmployeeFormInitialValues {
  name: string;
  storeId: string;
  dailyWage: string;
  joinedAt: string;
  isActive: boolean;
}

type EmployeeFormProps =
  | {
      mode: "create";
      stores: Store[];
      initialValues?: undefined;
      submitting: boolean;
      submitError?: string | null;
      onSubmit: (values: CreateEmployeeInput) => void;
    }
  | {
      mode: "edit";
      stores: Store[];
      initialValues: EmployeeFormInitialValues;
      submitting: boolean;
      submitError?: string | null;
      onSubmit: (values: UpdateEmployeeInput) => void;
    };

const emptyValues: EmployeeFormInitialValues = { name: "", storeId: "", dailyWage: "", joinedAt: "", isActive: true };

export function EmployeeForm({ mode, stores, initialValues, submitting, submitError, onSubmit }: EmployeeFormProps) {
  const base = initialValues ?? emptyValues;
  const [name, setName] = useState(base.name);
  const [storeId, setStoreId] = useState(base.storeId);
  const [dailyWage, setDailyWage] = useState(base.dailyWage);
  const [joinedAt, setJoinedAt] = useState(base.joinedAt);
  const [isActive, setIsActive] = useState(base.isActive);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): CreateEmployeeInput | UpdateEmployeeInput | null {
    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    const wage = Number(dailyWage);

    if (!trimmedName) nextErrors.name = "Name is required";
    if (!storeId) nextErrors.storeId = "Select a store";
    if (!dailyWage.trim() || !Number.isFinite(wage) || wage <= 0) {
      nextErrors.dailyWage = "Enter a valid amount greater than 0";
    }
    if (!joinedAt.trim() || !isValidDateOnly(joinedAt.trim())) {
      nextErrors.joinedAt = "Enter a valid date as YYYY-MM-DD";
    }

    const trimmedEmail = email.trim();
    if (mode === "create") {
      const hasEmail = trimmedEmail.length > 0;
      const hasPassword = password.length > 0;
      if (hasEmail !== hasPassword) {
        nextErrors.password = "Email and password must be provided together, or not at all";
      }
      if (hasEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
        nextErrors.email = "Enter a valid email address";
      }
      if (hasPassword && password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    if (mode === "create") {
      const payload: CreateEmployeeInput = { name: trimmedName, storeId, dailyWage: wage, joinedAt: joinedAt.trim() };
      if (trimmedEmail && password) {
        payload.email = trimmedEmail;
        payload.password = password;
      }
      return payload;
    }

    const editPayload: UpdateEmployeeInput = {
      name: trimmedName,
      storeId,
      dailyWage: wage,
      joinedAt: joinedAt.trim(),
      isActive,
    };
    return editPayload;
  }

  function handleSubmit() {
    const payload = validate();
    if (!payload) return;
    // validate() returns a CreateEmployeeInput when mode === "create" and an
    // UpdateEmployeeInput otherwise, exactly matching onSubmit's prop type for
    // that same mode — TS can't link that invariant across the two branches
    // of the EmployeeFormProps union, so it's asserted here instead.
    (onSubmit as (values: CreateEmployeeInput | UpdateEmployeeInput) => void)(payload);
  }

  return (
    <View>
      <AppInput label="Name" placeholder="Employee's full name" value={name} onChangeText={setName} errorMessage={errors.name} />

      <StorePickerField stores={stores} value={storeId} onChange={setStoreId} errorMessage={errors.storeId} />

      <AppInput
        label="Daily wage (₹)"
        placeholder="e.g. 700"
        value={dailyWage}
        onChangeText={setDailyWage}
        errorMessage={errors.dailyWage}
        keyboardType="decimal-pad"
      />

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
            <AppText variant="caption">Inactive employees are kept, never deleted</AppText>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: colors.border, true: colors.primaryDeep }}
            thumbColor={isActive ? colors.primary : colors.textMuted}
            accessibilityLabel="Employee active status"
          />
        </View>
      ) : null}

      {mode === "create" ? (
        <>
          <Divider />
          <AppText variant="bodySmall" style={styles.sectionHint}>
            Login account (optional) — leave both blank for an employee with no login access.
          </AppText>
          <AppInput
            label="Email"
            placeholder="employee@company.com"
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

      {submitError ? (
        <AppText variant="bodySmall" style={styles.formError}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton
        label={mode === "create" ? "Create employee" : "Save changes"}
        onPress={handleSubmit}
        loading={submitting}
      />
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
  sectionHint: {
    marginBottom: spacing.md,
  },
  formError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
});
