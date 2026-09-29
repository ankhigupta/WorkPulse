import { StyleSheet, View } from "react-native";
import { AppInput } from "./AppInput";
import { spacing } from "../theme";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  startError?: string;
  endError?: string;
}

// Plain YYYY-MM-DD text fields, same pattern used everywhere else in this
// app (Employee.joinedAt, Payroll periods, Attendance date) — never a
// Date-object round trip, so there's no local-timezone shift risk between
// what's typed here and what's sent to the backend.
export function DateRangeFilter({ startDate, endDate, onStartDateChange, onEndDateChange, startError, endError }: DateRangeFilterProps) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <AppInput
          label="Start date"
          placeholder="YYYY-MM-DD"
          value={startDate}
          onChangeText={onStartDateChange}
          errorMessage={startError}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <View style={styles.field}>
        <AppInput
          label="End date"
          placeholder="YYYY-MM-DD"
          value={endDate}
          onChangeText={onEndDateChange}
          errorMessage={endError}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  field: {
    flex: 1,
  },
});
