import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppInput } from "./AppInput";
import { colors, radii, spacing, touchTarget } from "../theme";
import { isValidDateOnly } from "../utils/validation";
import type { Employee } from "../types/employee";
import type { Store } from "../types/store";
import type { AttendanceStatus, CreateAttendanceInput } from "../types/attendance";

interface StorePickerFieldProps {
  stores: Store[];
  value: string | undefined;
  onChange: (storeId: string | undefined) => void;
}

// ORGANIZATION_ADMIN only — "All stores" plus every store in the org. This
// is purely a client-side filter on the Employee picker below it; the
// backend never receives a storeId from this screen at all (createAttendance
// derives storeId from the employee's own record), so there is nothing
// here for an admin to use as an authorization shortcut even if they tried.
function StorePickerField({ stores, value, onChange }: StorePickerFieldProps) {
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
        style={styles.pickerTrigger}
      >
        <AppText variant="body" style={!selected && styles.placeholder}>
          {selected?.name ?? "All stores"}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <AppText variant="sectionTitle" style={styles.modalTitle}>
              Select a store
            </AppText>
            <ScrollView>
              <Pressable
                onPress={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                style={styles.modalRow}
                accessibilityRole="button"
              >
                <AppText variant="body">All stores</AppText>
                {value === undefined ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
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
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// STORE_MANAGER only — not a picker at all, since there's nothing to pick:
// their store is fixed, and GET /stores 403s for this role anyway (so
// there is no way for this screen to resolve and display the store's
// actual name). A plain non-interactive field communicates "fixed" more
// honestly than a disabled-looking dropdown would.
function FixedStoreField() {
  return (
    <View style={styles.field}>
      <AppText variant="label" style={styles.label}>
        Store
      </AppText>
      <View style={styles.fixedField}>
        <AppText variant="body" style={styles.fixedFieldText}>
          Your assigned store
        </AppText>
      </View>
    </View>
  );
}

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
  /** ORGANIZATION_ADMIN only — ignored (and the store picker hidden) for
   *  STORE_MANAGER, whose store is fixed and whose employee list is
   *  already server-scoped to it. */
  isAdmin: boolean;
  stores: Store[];
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
//
// Field order is Store, Employee, Status, Date — the store filter exists
// purely to narrow the Employee picker below it; it is never sent to the
// backend (createAttendance has no storeId input field at all), so it
// can't function as an authorization boundary even if someone tried to
// make it one. The real scoping already happens server-side: for
// STORE_MANAGER, `employees` arrives from GET /api/employees pre-filtered
// to their assigned store.
export function AttendanceForm({ employees, isAdmin, stores, initialDate, submitting, submitError, onSubmit }: AttendanceFormProps) {
  const [storeId, setStoreId] = useState<string | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const visibleEmployees = useMemo(() => {
    if (!isAdmin || !storeId) return employees;
    return employees.filter((employee) => employee.storeId === storeId);
  }, [employees, isAdmin, storeId]);

  // Switching the store filter clears the employee selection whenever it
  // no longer belongs to the newly-chosen store, right at the point of
  // the change — not as a reactive effect watching derived state.
  function handleStoreChange(nextStoreId: string | undefined) {
    setStoreId(nextStoreId);
    if (!nextStoreId || !employeeId) return;
    const stillVisible = employees.some((employee) => employee.id === employeeId && employee.storeId === nextStoreId);
    if (!stillVisible) setEmployeeId("");
  }

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
      {isAdmin ? (
        <StorePickerField stores={stores} value={storeId} onChange={handleStoreChange} />
      ) : (
        <FixedStoreField />
      )}

      <EmployeePickerField employees={visibleEmployees} value={employeeId} onChange={setEmployeeId} errorMessage={errors.employeeId} />

      <StatusToggle value={status} onChange={setStatus} />

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
  fixedField: {
    minHeight: touchTarget,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  fixedFieldText: {
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
