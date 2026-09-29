import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { HomeScreen } from "../screens/HomeScreen";
import { AttendanceScreen } from "../screens/AttendanceScreen";
import { EmployeesNavigator } from "./EmployeesNavigator";
import { PayrollScreen } from "../screens/PayrollScreen";
import { MoreScreen } from "../screens/MoreScreen";
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
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Employees" component={EmployeesNavigator} />
      <Tab.Screen name="Payroll" component={PayrollScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}
