import { StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { IconButton } from "./IconButton";
import { spacing } from "../theme";
import { shiftDateOnly, todayDateOnly } from "../utils/date";
import { formatDateHeading, formatDateOnly } from "../utils/format";

interface AttendanceDateSelectorProps {
  date: string;
  onChange: (date: string) => void;
}

// A lightweight prev/next day stepper — no calendar-picker dependency.
// Forward navigation stops at today: attendance for a future date isn't a
// real thing yet, so there's nothing useful to browse to past it.
export function AttendanceDateSelector({ date, onChange }: AttendanceDateSelectorProps) {
  const today = todayDateOnly();
  const isToday = date === today;

  return (
    <View style={styles.row}>
      <IconButton
        icon="chevron-back"
        accessibilityLabel="Previous day"
        onPress={() => onChange(shiftDateOnly(date, -1))}
      />
      <View style={styles.center}>
        <AppText variant="sectionTitle">{formatDateHeading(date, today)}</AppText>
        <AppText variant="bodySmall">{formatDateOnly(date)}</AppText>
      </View>
      <IconButton
        icon="chevron-forward"
        accessibilityLabel="Next day"
        disabled={isToday}
        onPress={() => onChange(shiftDateOnly(date, 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  center: {
    alignItems: "center",
    gap: 2,
  },
});
