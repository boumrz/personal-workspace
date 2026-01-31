import React, { Suspense, lazy } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../context";

const SavingsScreen = lazy(() => import("../screens/SavingsScreen"));
const AddSavingScreen = lazy(() => import("../screens/AddSavingScreen"));

function Fallback() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bgBase }}>
      <ActivityIndicator size="large" color={theme.accentMuted} />
    </View>
  );
}

function withSuspense(Lazy: React.LazyExoticComponent<React.ComponentType<any>>) {
  return function Wrapped(props: any) {
    return (
      <React.Suspense fallback={<Fallback />}>
        <Lazy {...props} />
      </React.Suspense>
    );
  };
}

const Stack = createNativeStackNavigator();

export default function SavingsStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.bgCard },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: { fontWeight: "600" as const, fontSize: 18 },
      }}
    >
      <Stack.Screen
        name="SavingsList"
        component={withSuspense(SavingsScreen)}
        options={{ title: "Накопления" }}
      />
      <Stack.Screen
        name="AddSaving"
        component={withSuspense(AddSavingScreen)}
        options={{ title: "Новое накопление" }}
      />
    </Stack.Navigator>
  );
}
