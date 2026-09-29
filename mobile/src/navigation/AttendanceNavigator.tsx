import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AttendanceListScreen } from "../screens/attendance/AttendanceListScreen";
import { AttendanceCreateScreen } from "../screens/attendance/AttendanceCreateScreen";
import { CorrectionsListScreen } from "../screens/attendance/CorrectionsListScreen";
import { CorrectionCreateScreen } from "../screens/attendance/CorrectionCreateScreen";
import { colors } from "../theme";
import type { AttendanceStackParamList } from "./types";

const Stack = createNativeStackNavigator<AttendanceStackParamList>();

// Nested inside the "Attendance" bottom tab, same pattern as
// EmployeesNavigator — the tab bar stays intact, this just gives the list
// a push/back stack for the create flow.
export function AttendanceNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="AttendanceList" component={AttendanceListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AttendanceCreate" component={AttendanceCreateScreen} options={{ title: "Record Attendance" }} />
      <Stack.Screen name="CorrectionsList" component={CorrectionsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CorrectionCreate" component={CorrectionCreateScreen} options={{ title: "Request Correction" }} />
    </Stack.Navigator>
  );
}
