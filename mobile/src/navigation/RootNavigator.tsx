import React, { useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { track } from "@finance-assistant/shared";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import MainTabs from "./MainTabs";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, loading } = useAuth();
  const navigationRef = useRef<any>(null);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
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
