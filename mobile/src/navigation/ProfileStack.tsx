import React, { Suspense, lazy } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TouchableOpacity, Text, ActivityIndicator, View } from "react-native";
import { useTheme } from "../context";

const ProfileScreen = lazy(() => import("../screens/ProfileScreen"));
const CategoriesScreen = lazy(() => import("../screens/CategoriesScreen"));
const AddCategoryScreen = lazy(() => import("../screens/AddCategoryScreen"));
const EditProfileScreen = lazy(() => import("../screens/EditProfileScreen"));
const AddGoalScreen = lazy(() => import("../screens/AddGoalScreen"));
const GoalAmountScreen = lazy(() => import("../screens/GoalAmountScreen"));
const PrivacyPolicyScreen = lazy(() => import("../screens/PrivacyPolicyScreen"));
const TermsScreen = lazy(() => import("../screens/TermsScreen"));

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

export default function ProfileStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.bgCard },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: { fontWeight: "600" as const, fontSize: 18 },
        contentStyle: { backgroundColor: theme.bgBase },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={withSuspense(ProfileScreen)}
        options={{ title: "Мой профиль" }}
      />
      <Stack.Screen
        name="Categories"
        component={withSuspense(CategoriesScreen)}
        options={({ navigation }) => ({
          title: "Категории",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("AddCategory")}
              style={{ marginRight: 12 }}
            >
              <Text style={{ color: theme.accent, fontSize: 16 }}>Добавить</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="AddCategory"
        component={withSuspense(AddCategoryScreen)}
        options={{ title: "Новая категория" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={withSuspense(EditProfileScreen)}
        options={{ title: "Данные профиля" }}
      />
      <Stack.Screen
        name="AddGoal"
        component={withSuspense(AddGoalScreen)}
        options={({ route }: any) => ({
          title: route.params?.goal ? "Редактирование цели" : "Новая цель",
        })}
      />
      <Stack.Screen
        name="GoalAmount"
        component={withSuspense(GoalAmountScreen)}
        options={({ route }: any) => ({
          title: route.params?.type === "add" ? "Добавить к цели" : "Убавить от цели",
        })}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={withSuspense(PrivacyPolicyScreen)}
        options={{ title: "Политика конфиденциальности" }}
      />
      <Stack.Screen
        name="Terms"
        component={withSuspense(TermsScreen)}
        options={{ title: "Условия использования" }}
      />
    </Stack.Navigator>
  );
}
