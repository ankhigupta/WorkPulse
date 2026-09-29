import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, type Theme as NavigationTheme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/stores/authStore";
import { colors } from "./src/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

const navigationTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

// Only the handful of tokens Paper's own chrome (e.g. ripple/elevation)
// actually reads are overridden — WorkPulse's own components (AppButton,
// AppInput, AppCard, ...) are hand-built against ../theme and don't route
// through Paper at all. Paper is here so future screens can reach for its
// richer widgets (Menu, Snackbar, DataTable) without re-theming from scratch.
const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    background: colors.background,
    surface: colors.surface,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    error: colors.error,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap().finally(() => setAuthBootstrapped(true));
  }, [bootstrap]);

  const appReady = fontsLoaded && authBootstrapped;

  const onLayoutRootView = useCallback(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <SafeAreaProvider>
            <NavigationContainer theme={navigationTheme}>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </PaperProvider>
      </QueryClientProvider>
      <StatusBar style="light" />
    </View>
  );
}
