import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MoreHomeScreen } from "../screens/more/MoreHomeScreen";
import { AccountScreen } from "../screens/more/AccountScreen";
import { OrganizationScreen } from "../screens/more/OrganizationScreen";
import { AttendanceReportScreen } from "../screens/reports/AttendanceReportScreen";
import { PayrollReportScreen } from "../screens/reports/PayrollReportScreen";
import { PaymentsReportScreen } from "../screens/reports/PaymentsReportScreen";
import { WorkforceReportScreen } from "../screens/reports/WorkforceReportScreen";
import { StoreListScreen } from "../screens/stores/StoreListScreen";
import { StoreCreateScreen } from "../screens/stores/StoreCreateScreen";
import { StoreEditScreen } from "../screens/stores/StoreEditScreen";
import { colors } from "../theme";
import type { MoreStackParamList } from "./types";

const Stack = createNativeStackNavigator<MoreStackParamList>();

// Nested inside the "More" bottom tab, same pattern as every other tab.
// MoreHomeScreen adapts its sections to the authenticated role (see that
// file) — this navigator registers every screen unconditionally, the same
// way EmployeesNavigator always registers Manager screens even though
// only ORGANIZATION_ADMIN ever navigates to them: the entry points are
// gated, not the routes themselves.
export function MoreNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="MoreHome" component={MoreHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AttendanceReport" component={AttendanceReportScreen} options={{ title: "Attendance Report" }} />
      <Stack.Screen name="PayrollReport" component={PayrollReportScreen} options={{ title: "Payroll Report" }} />
      <Stack.Screen name="PaymentsReport" component={PaymentsReportScreen} options={{ title: "Payments Report" }} />
      <Stack.Screen name="WorkforceReport" component={WorkforceReportScreen} options={{ title: "Workforce Report" }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Organization" component={OrganizationScreen} options={{ title: "Organization" }} />
      <Stack.Screen name="StoreList" component={StoreListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StoreCreate" component={StoreCreateScreen} options={{ title: "New Store" }} />
      <Stack.Screen name="StoreEdit" component={StoreEditScreen} options={{ title: "Edit Store" }} />
    </Stack.Navigator>
  );
}
