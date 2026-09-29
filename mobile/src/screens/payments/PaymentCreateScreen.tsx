import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  EmptyState,
  LoadingState,
  ScreenContainer,
} from "../../components";
import { useCreatePayment } from "../../hooks/usePayments";
import { useEmployeeList } from "../../hooks/useEmployees";
import { ApiError } from "../../types/api";
import { colors, radii, spacing, touchTarget } from "../../theme";
import { todayDateOnly } from "../../utils/date";
import { isValidDateOnly, isValidMoneyAmount } from "../../utils/validation";
import type { Employee } from "../../types/employee";
import type { PayrollStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<PayrollStackParamList, "PaymentCreate">;

interface EmployeePickerFieldProps {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string) => void;
  errorMessage?: string;
}

// Same self-contained modal-list picker pattern used in Attendance/Payroll
// create forms — kept local rather than extracted, consistent with the
// precedent set there (this milestone's scope is Payments, not a refactor
// of already-shipped modules).
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

export function PaymentCreateScreen({ route, navigation }: Props) {
  const fixedEmployeeId = route.params?.employeeId;
  const fixedEmployeeName = route.params?.employeeName;

  const employeeQuery = useEmployeeList();
  const createMutation = useCreatePayment();

  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? "");
  const [amount, setAmount] = useState("");
  // "Paid on" is a calendar date (defaults to today); submitted as noon UTC
  // on that date — see the comment above paidAtInstant below for why.
  const [paidOn, setPaidOn] = useState(todayDateOnly());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!employeeId) nextErrors.employeeId = "Select an employee";
    if (!isValidMoneyAmount(amount.trim())) {
      nextErrors.amount = "Enter a valid amount (up to 2 decimal places)";
    }
    if (!paidOn.trim() || !isValidDateOnly(paidOn.trim())) {
      nextErrors.paidOn = "Enter a valid date as YYYY-MM-DD";
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length > 500) {
      nextErrors.note = "Note must be 500 characters or fewer";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Normalized to noon UTC on the chosen calendar date, always — not
    // "now" for today and midnight for a backdated date. A single,
    // consistent rule that can never land on the wrong side of a day
    // boundary in any real-world timezone (noon UTC is never within a
    // day's edge of local midnight anywhere), so "Paid on" always means
    // the same calendar date on the server that it showed in this form.
    const paidAtInstant = `${paidOn.trim()}T12:00:00.000Z`;

    createMutation.mutate(
      {
        employeeId,
        amount: Number(amount.trim()),
        paidAt: paidAtInstant,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      },
      { onSuccess: () => navigation.goBack() },
    );
  }

  if (!fixedEmployeeId && employeeQuery.isPending) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading employees…" />
      </ScreenContainer>
    );
  }

  if (!fixedEmployeeId && employeeQuery.isError) {
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

  const submitError = createMutation.error
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : "Something went wrong. Please try again."
    : null;

  return (
    <ScreenContainer scroll>
      {fixedEmployeeId ? (
        <AppCard style={styles.fixedEmployeeCard}>
          <AppText variant="label">EMPLOYEE</AppText>
          <AppText variant="bodyStrong">{fixedEmployeeName ?? "Selected employee"}</AppText>
        </AppCard>
      ) : (
        <EmployeePickerField
          employees={employeeQuery.data ?? []}
          value={employeeId}
          onChange={setEmployeeId}
          errorMessage={errors.employeeId}
        />
      )}

      <AppInput
        label="Amount (₹)"
        placeholder="e.g. 5000"
        value={amount}
        onChangeText={setAmount}
        errorMessage={errors.amount}
        keyboardType="decimal-pad"
      />

      <AppInput
        label="Paid on"
        placeholder="YYYY-MM-DD"
        value={paidOn}
        onChangeText={setPaidOn}
        errorMessage={errors.paidOn}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <AppInput
        label="Note (optional)"
        placeholder="e.g. Cash advance, bank transfer reference"
        value={note}
        onChangeText={setNote}
        errorMessage={errors.note}
        maxLength={500}
      />

      {submitError ? (
        <AppText variant="bodySmall" style={styles.submitError}>
          {submitError}
        </AppText>
      ) : null}

      <AppText variant="caption" style={styles.notice}>
        The server rejects any payment that would exceed the employee&rsquo;s outstanding balance from finalized payroll.
      </AppText>

      <AppButton label="Record payment" onPress={handleSubmit} loading={createMutation.isPending} />
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
  fixedEmployeeCard: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
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
  submitError: {
    color: colors.error,
    marginBottom: spacing.md,
  },
  notice: {
    marginBottom: spacing.lg,
    textAlign: "center",
  },
});
