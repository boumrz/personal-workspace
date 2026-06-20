import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, Linking } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { track } from "@finance-assistant/shared";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { parseImportDeepLink } from "../services/dataTools";
import LoginScreen from "../screens/LoginScreen";
import MainTabs from "./MainTabs";
import { navigationRef } from "./rootNavigation";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, loading } = useAuth();
  const { theme, isDark } = useTheme();
  const [navReady, setNavReady] = useState(false);
  const navReadyRef = useRef(false);
  const pendingImportRef = useRef<ReturnType<typeof parseImportDeepLink> | null>(null);

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

  useEffect(() => {
    navReadyRef.current = navReady;
  }, [navReady]);

  useEffect(() => {
    const processUrl = (url?: string | null) => {
      if (!url) return;
      const parsed = parseImportDeepLink(url);
      if (!parsed) return;

      if (navReadyRef.current && navigationRef.isReady()) {
        (navigationRef as any).navigate(
          "Main",
          {
            screen: "Profile",
            params: {
              screen: "DataImportReview",
              params: {
                preview: parsed.preview,
                kind: parsed.kind,
              },
            },
          } as never
        );
      } else {
        pendingImportRef.current = parsed;
      }
    };

    void Linking.getInitialURL().then(processUrl);
    const subscription = Linking.addEventListener("url", (event) => {
      processUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const pending = pendingImportRef.current;
    if (!pending || !navReady || !navigationRef.isReady()) {
      return;
    }

    (navigationRef as any).navigate(
      "Main",
      {
        screen: "Profile",
        params: {
          screen: "DataImportReview",
          params: {
            preview: pending.preview,
            kind: pending.kind,
          },
        },
      } as never
    );
    pendingImportRef.current = null;
  }, [navReady]);

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
        setNavReady(true);
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
