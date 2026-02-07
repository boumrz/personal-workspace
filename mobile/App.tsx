import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setApiBaseUrl, setAnalyticsPlatform, track } from "@finance-assistant/shared";
import { API_BASE_URL } from "./src/constants/config";
import { AuthProvider, ThemeProvider, useTheme } from "./src/context";
import RootNavigator from "./src/navigation/RootNavigator";

// Set API base URL for the shared API client (used by auth and data layers)
setApiBaseUrl(API_BASE_URL);
setAnalyticsPlatform("android");

function AppContent() {
  const { isDark, theme } = useTheme();

  useEffect(() => {
    track("app_open");
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bgBase }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={theme.bgBase} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
