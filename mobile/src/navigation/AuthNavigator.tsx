import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { OrgSignupScreen } from "../screens/auth/OrgSignupScreen";
import { JoinOrganizationScreen } from "../screens/auth/JoinOrganizationScreen";
import { RequestSubmittedScreen } from "../screens/auth/RequestSubmittedScreen";
import { RequestStatusScreen } from "../screens/auth/RequestStatusScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  /** Which screen this stack mounts on — RootNavigator decides this from
   * whether a pending access request exists, so an app restart with one
   * lands directly on RequestStatus instead of flashing Login first. */
  initialRouteName?: keyof AuthStackParamList;
}

export function AuthNavigator({ initialRouteName = "Login" }: AuthNavigatorProps) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OrgSignup" component={OrgSignupScreen} />
      <Stack.Screen name="JoinOrganization" component={JoinOrganizationScreen} />
      <Stack.Screen name="RequestSubmitted" component={RequestSubmittedScreen} />
      <Stack.Screen name="RequestStatus" component={RequestStatusScreen} />
    </Stack.Navigator>
  );
}
