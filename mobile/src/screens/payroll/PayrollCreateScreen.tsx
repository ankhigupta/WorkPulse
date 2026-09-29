import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppInput, AppText, EmptyState, LoadingState, ScreenContainer } from "../../components";
import { useCreatePayroll } from "../../hooks/usePayroll";
import { useEmployeeList } from "../../hooks/useEmployees";
import { ApiError } from "../../types/api";
import { colors, radii, spacing, touchTarget } from "../../theme";
import { addMonths, endOfMonth, startOfMonth, todayDateOnly } from "../../utils/date";
import { isValidDateOnly } from "../../utils/validation";
import type { Employee } from "../../types/employee";
import type { PayrollStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PayrollStackParamList, "PayrollCreate">;

interface EmployeePickerFieldProps {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string) => void;
  errorMessage?: string;
}

// Same self-contained modal-list picker pattern used in AttendanceForm and
// EmployeeForm — kept as its own local copy rather than extracted into a
// shared component, since this milestone's scope is Payroll, not a
// refactor of the already-shipped Employees/Attendance modules.
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

export function PayrollCreateScreen({ navigation }: Props) {
  const employeeQuery = useEmployeeList();
  const createMutation = useCreatePayroll();

  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function applyPreset(monthsAgo: number) {
    const anchor = addMonths(todayDateOnly(), -monthsAgo);
    setPeriodStart(startOfMonth(anchor));
    setPeriodEnd(endOfMonth(anchor));
    setErrors((prev) => ({ ...prev, periodStart: "", periodEnd: "" }));
  }

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!employeeId) nextErrors.employeeId = "Select an employee";
    if (!periodStart.trim() || !isValidDateOnly(periodStart.trim())) {
      nextErrors.periodStart = "Enter a valid date as YYYY-MM-DD";
    }
    if (!periodEnd.trim() || !isValidDateOnly(periodEnd.trim())) {
      nextErrors.periodEnd = "Enter a valid date as YYYY-MM-DD";
    }
    if (!nextErrors.periodStart && !nextErrors.periodEnd && periodStart.trim() > periodEnd.trim()) {
      nextErrors.periodEnd = "Period end must be on or after period start";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    createMutation.mutate(
      { employeeId, periodStart: periodStart.trim(), periodEnd: periodEnd.trim() },
      { onSuccess: () => navigation.goBack() },
    );
  }

  if (employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading employees…" />
      </ScreenContainer>
    );
  }

  if (employeeQuery.isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load employees"
          message={employeeQuery.error instanceof ApiError ? employeeQuery.error.message : "Something went wrong. Please try again."}
          actionLabel="Retry"
          onAction={() => employeeQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (employeeQuery.data.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState icon="people-outline" title="No employees yet" message="Add an employee before creating payroll." />
      </ScreenContainer>
    );
  }

  const submitError = createMutation.error
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      <EmployeePickerField employees={employeeQuery.data} value={employeeId} onChange={setEmployeeId} errorMessage={errors.employeeId} />

      <View style={styles.presetRow}>
        <View style={styles.presetButton}>
          <AppButton label="This month" variant="secondary" onPress={() => applyPreset(0)} />
        </View>
        <View style={styles.presetButton}>
          <AppButton label="Last month" variant="secondary" onPress={() => applyPreset(1)} />
        </View>
      </View>

      <AppInput
        label="Period start"
        placeholder="YYYY-MM-DD"
        value={periodStart}
        onChangeText={setPeriodStart}
        errorMessage={errors.periodStart}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AppInput
        label="Period end"
        placeholder="YYYY-MM-DD"
        value={periodEnd}
        onChangeText={setPeriodEnd}
        errorMessage={errors.periodEnd}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {submitError ? (
        <AppText variant="bodySmall" style={styles.submitError}>
          {submitError}
        </AppText>
      ) : null}

      <AppText variant="caption" style={styles.notice}>
        The total wage is calculated by the server from PRESENT attendance in the selected period — it is never entered
        manually.
      </AppText>

      <AppButton label="Create payroll" onPress={handleSubmit} loading={createMutation.isPending} />
    </ScreenContainer>
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
  presetRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  presetButton: {
    flex: 1,
  },
  submitError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
  notice: {
    marginBottom: spacing.lg,
    textAlign: "center",
  },
});
