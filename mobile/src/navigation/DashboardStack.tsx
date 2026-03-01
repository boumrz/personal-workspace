import React, { Suspense, lazy } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../context";
import CompactHeader from "../components/CompactHeader";

const DashboardScreen = lazy(() => import("../screens/DashboardScreen"));

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

export default function DashboardStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        header: (props) => <CompactHeader {...props} />,
        contentStyle: { backgroundColor: theme.bgBase },
      }}
    >
      <Stack.Screen
        name="DashboardMain"
        component={withSuspense(DashboardScreen)}
        options={{ title: "Отчёт" }}
      />
    </Stack.Navigator>
  );
}
