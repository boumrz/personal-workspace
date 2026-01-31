import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { setApiBaseUrl, setAnalyticsPlatform, track } from "@finance-assistant/shared";
import { API_BASE_URL } from "./src/constants/config";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";

// Set API base URL for the shared API client (used by auth and data layers)
setApiBaseUrl(API_BASE_URL);
setAnalyticsPlatform("android");

export default function App() {
  useEffect(() => {
    track("app_open");
  }, []);

  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="dark" backgroundColor="#e8e8ed" />
    </AuthProvider>
  );
}
