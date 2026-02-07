import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context";
import OperationsStack from "./OperationsStack";
import DashboardStack from "./DashboardStack";
import SavingsStack from "./SavingsStack";
import ProfileStack from "./ProfileStack";

const Tab = createBottomTabNavigator();
const TAB_BAR_TOP_PADDING = 10;
const TAB_BAR_MIN_HEIGHT = 56;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<string, { active: IconName; inactive: IconName }> = {
  Operations: { active: "wallet", inactive: "wallet-outline" },
  Dashboard: { active: "bar-chart", inactive: "bar-chart-outline" },
  Savings: { active: "cash", inactive: "cash-outline" },
  Profile: { active: "person", inactive: "person-outline" },
};

export default function MainTabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 24;
  const tabBarHeight = TAB_BAR_MIN_HEIGHT + TAB_BAR_TOP_PADDING + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bgBase },
        tabBarStyle: {
          backgroundColor: theme.bgCard,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingTop: TAB_BAR_TOP_PADDING,
          paddingBottom: bottomInset,
          height: tabBarHeight,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" as const },
        tabBarIcon: ({ focused, color }) => {
          const icons = tabIcons[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Operations"
        component={OperationsStack}
        options={{ title: "Операции", tabBarLabel: "Операции" }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{ title: "Дашборд", tabBarLabel: "Дашборд" }}
      />
      <Tab.Screen
        name="Savings"
        component={SavingsStack}
        options={{ title: "Накопления", tabBarLabel: "Накопления" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: "Профиль", tabBarLabel: "Профиль" }}
      />
    </Tab.Navigator>
  );
}
