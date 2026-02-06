import React, { useRef, useMemo } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { track } from "@finance-assistant/shared";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import LoginScreen from "../screens/LoginScreen";
import MainTabs from "./MainTabs";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, loading } = useAuth();
  const { theme, isDark } = useTheme();
  const navigationRef = useRef<any>(null);

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: theme.bgBase,
        card: theme.bgCard,
        primary: theme.accent,
        text: theme.textPrimary,
        border: theme.border,
      },
    }),
    [theme, isDark]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bgBase, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.accentMuted} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        const name = navigationRef.current?.getCurrentRoute()?.name;
        if (name) track("screen_view", { screen_name: name });
      }}
      onStateChange={() => {
        const name = navigationRef.current?.getCurrentRoute()?.name;
        if (name) track("screen_view", { screen_name: name });
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
