import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { colors, radii, spacing, touchTarget } from "../theme";
import { isValidDateOnly } from "../utils/validation";
import type { Employee } from "../types/employee";
import type { AttendanceStatus, CreateAttendanceInput } from "../types/attendance";

interface EmployeePickerFieldProps {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string) => void;
  errorMessage?: string;
}

function EmployeePickerField({ employees, value, onChange, errorMessage }: EmployeePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = employees.find((e) => e.id === value);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(query));
  }, [employees, search]);

  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        Employee
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Select an employee"
        style={[styles.pickerTrigger, errorMessage && styles.pickerTriggerError]}
      >
        <AppText variant="body" style={!selected && styles.placeholder}>
          {selected?.name ?? "Select an employee"}
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
              Select an employee
            </AppText>
            <AppInput label="Search" placeholder="Search by name" value={search} onChangeText={setSearch} autoCorrect={false} />
            <ScrollView>
              {filtered.map((employee) => (
                <Pressable
                  key={employee.id}
                  onPress={() => {
                    onChange(employee.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  style={styles.modalRow}
                  accessibilityRole="button"
                >
                  <AppText variant="body">{employee.name}</AppText>
                  {employee.id === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              ))}
              {filtered.length === 0 ? (
                <AppText variant="bodySmall" style={styles.noResults}>
                  No employees match that search.
                </AppText>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatusToggle({ value, onChange }: { value: AttendanceStatus; onChange: (status: AttendanceStatus) => void }) {
  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        Status
      </AppText>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => onChange("PRESENT")}
          accessibilityRole="button"
          accessibilityState={{ selected: value === "PRESENT" }}
          style={[styles.toggleOption, value === "PRESENT" && styles.toggleOptionPresentActive]}
        >
          <AppText variant="bodyStrong" style={value === "PRESENT" ? styles.toggleTextActive : styles.toggleText}>
            Present
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => onChange("ABSENT")}
          accessibilityRole="button"
          accessibilityState={{ selected: value === "ABSENT" }}
          style={[styles.toggleOption, value === "ABSENT" && styles.toggleOptionAbsentActive]}
        >
          <AppText variant="bodyStrong" style={value === "ABSENT" ? styles.toggleTextActive : styles.toggleText}>
            Absent
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

interface AttendanceFormProps {
  employees: Employee[];
  initialDate: string;
  submitting: boolean;
  submitError?: string | null;
  onSubmit: (values: CreateAttendanceInput) => void;
}

// method is always "MANUAL" — QR capture has no mobile UI yet (no scanner
// in this milestone), so there's nothing to offer a picker for.
// checkInAt is omitted entirely: no design reference calls for it, and
// leaving it out avoids introducing timezone-instant-input complexity
// this milestone doesn't need.
export function AttendanceForm({ employees, initialDate, submitting, submitError, onSubmit }: AttendanceFormProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!employeeId) nextErrors.employeeId = "Select an employee";
    if (!date.trim() || !isValidDateOnly(date.trim())) nextErrors.date = "Enter a valid date as YYYY-MM-DD";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ employeeId, date: date.trim(), status, method: "MANUAL" });
  }

  return (
    <View>
      <EmployeePickerField employees={employees} value={employeeId} onChange={setEmployeeId} errorMessage={errors.employeeId} />

      <AppInput
        label="Date"
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        errorMessage={errors.date}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <StatusToggle value={status} onChange={setStatus} />

      {submitError ? (
        <AppText variant="bodySmall" style={styles.formError}>
          {submitError}
        </AppText>
      ) : null}

      <AppButton label="Record attendance" onPress={handleSubmit} loading={submitting} />
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
  toggleRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  toggleOption: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  toggleOptionPresentActive: {
    backgroundColor: "rgba(95, 201, 138, 0.16)",
    borderColor: colors.success,
  },
  toggleOptionAbsentActive: {
    backgroundColor: "rgba(238, 111, 138, 0.16)",
    borderColor: colors.error,
  },
  toggleText: {
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.text,
  },
  formError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
});
