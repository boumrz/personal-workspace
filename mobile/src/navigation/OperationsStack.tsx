import React, { Suspense, lazy } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../context";
import CompactHeader from "../components/CompactHeader";

const TransactionsScreen = lazy(() => import("../screens/TransactionsScreen"));
const AddTransactionScreen = lazy(() => import("../screens/AddTransactionScreen"));
const CategoryFilterScreen = lazy(() => import("../screens/CategoryFilterScreen"));
const AddCategoryScreen = lazy(() => import("../screens/AddCategoryScreen"));

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

export default function OperationsStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        header: (props) => <CompactHeader {...props} />,
        contentStyle: { backgroundColor: theme.bgBase },
      }}
    >
      <Stack.Screen
        name="TransactionsList"
        component={withSuspense(TransactionsScreen)}
        options={{ title: "Операции" }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={withSuspense(AddTransactionScreen)}
        options={{ title: "Новая операция" }}
      />
      <Stack.Screen
        name="CategoryFilter"
        component={withSuspense(CategoryFilterScreen)}
        options={{ title: "Фильтр по категориям" }}
      />
      <Stack.Screen
        name="AddCategory"
        component={withSuspense(AddCategoryScreen)}
        options={{ title: "Новая категория" }}
      />
    </Stack.Navigator>
  );
}
