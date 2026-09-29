import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { EmployeeListScreen } from "../screens/employees/EmployeeListScreen";
import { EmployeeDetailScreen } from "../screens/employees/EmployeeDetailScreen";
import { EmployeeCreateScreen } from "../screens/employees/EmployeeCreateScreen";
import { EmployeeEditScreen } from "../screens/employees/EmployeeEditScreen";
import { ManagerListScreen } from "../screens/managers/ManagerListScreen";
import { ManagerDetailScreen } from "../screens/managers/ManagerDetailScreen";
import { ManagerCreateScreen } from "../screens/managers/ManagerCreateScreen";
import { ManagerEditScreen } from "../screens/managers/ManagerEditScreen";
import { colors } from "../theme";
import type { EmployeesStackParamList } from "./types";

const Stack = createNativeStackNavigator<EmployeesStackParamList>();

// Nested inside the "Employees" bottom tab (see AppNavigator) — the tab bar
// stays intact, this just gives the list a real push/back stack for
// detail/create/edit, same pattern React Navigation recommends for a tab
// that needs more than one screen. Managers live in this same stack rather
// than a separate tab — reached via a header button on EmployeeListScreen
// (admin-only), the same "sibling module, header-button entry point"
// pattern Corrections/Payments established elsewhere in this app.
export function EmployeesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="EmployeeList" component={EmployeeListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={{ title: "Employee" }} />
      <Stack.Screen name="EmployeeCreate" component={EmployeeCreateScreen} options={{ title: "New Employee" }} />
      <Stack.Screen name="EmployeeEdit" component={EmployeeEditScreen} options={{ title: "Edit Employee" }} />
      <Stack.Screen name="ManagerList" component={ManagerListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ManagerDetail" component={ManagerDetailScreen} options={{ title: "Manager" }} />
      <Stack.Screen name="ManagerCreate" component={ManagerCreateScreen} options={{ title: "New Manager" }} />
      <Stack.Screen name="ManagerEdit" component={ManagerEditScreen} options={{ title: "Edit Manager" }} />
    </Stack.Navigator>
  );
}
