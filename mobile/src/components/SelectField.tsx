import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppInput } from "./AppInput";
import { colors, radii, spacing, touchTarget } from "../theme";

export interface SelectFieldOption {
  id: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  placeholder: string;
  options: SelectFieldOption[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** Shown as the first row, selecting it calls onChange(undefined) — e.g. "All employees". */
  allLabel?: string;
  searchable?: boolean;
  errorMessage?: string;
}

// A single generic modal-list picker — the same job StorePickerField and
// EmployeePickerField have each done separately in Attendance/Payroll/
// Payment/Manager's create forms, generalized here because the Reports
// screens need an employee picker AND a store picker in several places
// within this one milestone. Existing forms are left exactly as they are;
// this doesn't replace their local copies.
export function SelectField({ label, placeholder, options, value, onChange, allLabel, searchable, errorMessage }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  }, [options, search, searchable]);

  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.trigger, errorMessage && styles.triggerError]}
      >
        <AppText variant="body" style={!selected && styles.placeholder}>
          {selected?.label ?? allLabel ?? placeholder}
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
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <AppText variant="sectionTitle" style={styles.modalTitle}>
              {label}
            </AppText>
            {searchable ? (
              <AppInput label="Search" placeholder="Search" value={search} onChangeText={setSearch} autoCorrect={false} />
            ) : null}
            <ScrollView>
              {allLabel ? (
                <Pressable
                  onPress={() => {
                    onChange(undefined);
                    setOpen(false);
                    setSearch("");
                  }}
                  style={styles.modalRow}
                  accessibilityRole="button"
                >
                  <AppText variant="body">{allLabel}</AppText>
                  {value === undefined ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              ) : null}
              {filtered.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    onChange(option.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  style={styles.modalRow}
                  accessibilityRole="button"
                >
                  <AppText variant="body">{option.label}</AppText>
                  {option.id === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              ))}
              {searchable && filtered.length === 0 ? (
                <AppText variant="bodySmall" style={styles.noResults}>
                  No matches.
                </AppText>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  trigger: {
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
  triggerError: {
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
    maxHeight: "80%",
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
  noResults: {
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});
