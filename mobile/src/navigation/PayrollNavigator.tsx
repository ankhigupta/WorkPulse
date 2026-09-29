import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PayrollListScreen } from "../screens/payroll/PayrollListScreen";
import { PayrollCreateScreen } from "../screens/payroll/PayrollCreateScreen";
import { PaymentsListScreen } from "../screens/payments/PaymentsListScreen";
import { PaymentCreateScreen } from "../screens/payments/PaymentCreateScreen";
import { EmployeeBalanceScreen } from "../screens/payments/EmployeeBalanceScreen";
import { colors } from "../theme";
import type { PayrollStackParamList } from "./types";

const Stack = createNativeStackNavigator<PayrollStackParamList>();

// Nested inside the "Payroll" bottom tab, same pattern as
// Employees/AttendanceNavigator. Only ever mounted for ORGANIZATION_ADMIN
// — AppNavigator doesn't register the Payroll tab at all for any other
// role (see ADR-011), so there's no in-navigator role check needed here.
// Payments live in this same stack rather than a separate tab — reached
// via a header button on PayrollListScreen, the same "sibling module
// reached from its parent's list screen" pattern Attendance Corrections
// established under the Attendance tab.
export function PayrollNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="PayrollList" component={PayrollListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PayrollCreate" component={PayrollCreateScreen} options={{ title: "Create Payroll" }} />
      <Stack.Screen name="PaymentsList" component={PaymentsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PaymentCreate" component={PaymentCreateScreen} options={{ title: "Record Payment" }} />
      <Stack.Screen name="EmployeeBalance" component={EmployeeBalanceScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
