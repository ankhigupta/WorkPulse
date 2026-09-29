import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { colors, spacing } from "../theme";
import type { CreateStoreInput, UpdateStoreInput } from "../types/store";

interface StoreFormInitialValues {
  name: string;
  address: string;
  isActive: boolean;
}

type StoreFormProps =
  | {
      mode: "create";
      initialValues?: undefined;
      submitting: boolean;
      submitError?: string | null;
      onSubmit: (values: CreateStoreInput) => void;
    }
  | {
      mode: "edit";
      initialValues: StoreFormInitialValues;
      submitting: boolean;
      submitError?: string | null;
      onSubmit: (values: UpdateStoreInput) => void;
    };

const emptyValues: StoreFormInitialValues = { name: "", address: "", isActive: true };

// Store has no relation to pick (unlike Employee/Manager/Payroll forms) —
// just name/address/isActive, matching createStoreSchema/updateStoreSchema
// exactly. No delete anywhere; isActive is the only lifecycle control.
export function StoreForm({ mode, initialValues, submitting, submitError, onSubmit }: StoreFormProps) {
  const base = initialValues ?? emptyValues;
  const [name, setName] = useState(base.name);
  const [address, setAddress] = useState(base.address);
  const [isActive, setIsActive] = useState(base.isActive);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) nextErrors.name = "Name is required";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const trimmedAddress = address.trim();

    if (mode === "create") {
      const payload: CreateStoreInput = { name: trimmedName, ...(trimmedAddress ? { address: trimmedAddress } : {}) };
      onSubmit(payload);
      return;
    }

    const editPayload: UpdateStoreInput = {
      name: trimmedName,
      address: trimmedAddress,
      isActive,
    };
    onSubmit(editPayload);
  }

  return (
    <View>
      <AppInput label="Name" placeholder="Store name" value={name} onChangeText={setName} errorMessage={errors.name} />

      <AppInput label="Address (optional)" placeholder="Street, city" value={address} onChangeText={setAddress} />

      {mode === "edit" ? (
        <View style={styles.switchRow}>
          <View>
            <AppText variant="label">ACTIVE</AppText>
            <AppText variant="caption">Inactive stores are kept, never deleted</AppText>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: colors.border, true: colors.primaryDeep }}
            thumbColor={isActive ? colors.primary : colors.textMuted}
            accessibilityLabel="Store active status"
          />
        </View>
      ) : null}

      {submitError ? (
        <AppText variant="bodySmall" style={styles.formError}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton label={mode === "create" ? "Create store" : "Save changes"} onPress={handleSubmit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
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
