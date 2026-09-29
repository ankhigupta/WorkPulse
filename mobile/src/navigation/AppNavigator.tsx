import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { HomeScreen } from "../screens/HomeScreen";
import { AttendanceNavigator } from "./AttendanceNavigator";
import { EmployeesNavigator } from "./EmployeesNavigator";
import { PayrollNavigator } from "./PayrollNavigator";
import { MoreNavigator } from "./MoreNavigator";
import { useAuthStore } from "../stores/authStore";
import { colors } from "../theme";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

// Icon/label set matches the mobile design reference's bottom nav exactly:
// Home, Attendance, Employees, Payroll, More.
const tabIcons: Record<keyof AppTabParamList, { filled: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }> = {
  Home: { filled: "home", outline: "home-outline" },
  Attendance: { filled: "time", outline: "time-outline" },
  Employees: { filled: "people", outline: "people-outline" },
  Payroll: { filled: "card", outline: "card-outline" },
  More: { filled: "ellipsis-horizontal-circle", outline: "ellipsis-horizontal-circle-outline" },
};

export function AppNavigator() {
  // Payroll is ORGANIZATION_ADMIN-only on the backend (the whole router is
  // gated with requireRole(ORGANIZATION_ADMIN) — no STORE_MANAGER access
  // at all, unlike Attendance/Employees). The tab itself is left out of
  // the navigator entirely for any other role, rather than registered and
  // then blocked inside — there's nothing behind it to show.
  const role = useAuthStore((state) => state.user?.role);
  const showPayroll = role === "ORGANIZATION_ADMIN";

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? tabIcons[route.name].filled : tabIcons[route.name].outline}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Attendance" component={AttendanceNavigator} />
      <Tab.Screen name="Employees" component={EmployeesNavigator} />
      {showPayroll ? <Tab.Screen name="Payroll" component={PayrollNavigator} /> : null}
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}
