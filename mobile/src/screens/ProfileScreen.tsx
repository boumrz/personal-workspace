import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";
import type { Profile, Goal } from "@finance-assistant/shared";

export default function ProfileScreen({ navigation }: any) {
  const { api, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const balance = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return income - expense;
  }, [transactions]);

  const loadData = useCallback(async () => {
    try {
      const [profileData, transactionsData, goalsData] = await Promise.all([
        api.getProfile(),
        api.getTransactions().catch(() => []),
        api.getGoals().catch(() => []),
      ]);
      setProfile(profileData);
      setTransactions(transactionsData);
      setGoals(goalsData);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data when screen is focused (after editing)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleGoalDelete = (goal: Goal) => {
    Alert.alert("Удалить цель?", "Это действие нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteGoal(goal.id);
            setGoals((prev) => prev.filter((g) => g.id !== goal.id));
          } catch (e: any) {
            Alert.alert("Ошибка", e?.message ?? "Не удалось удалить цель");
          }
        },
      },
    ]);
  };

  const displayName = useMemo(() => {
    if (profile?.firstName) return profile.firstName;
    if (profile?.name) return profile.name.split(" ")[0];
    return "Пользователь";
  }, [profile]);

  const formattedDate = useMemo(() => {
    if (profile?.dateOfBirth) {
      return new Date(profile.dateOfBirth).toLocaleDateString("ru-RU");
    }
    return null;
  }, [profile]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accentMuted} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Кошелёк — зелёная карточка баланса */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Кошелёк</Text>
        <LinearGradient
          colors={[theme.incomeMutedDark, theme.incomeMutedDarker]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceIcon}>
            <Ionicons name="wallet-outline" size={24} color="#fff" />
          </View>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Баланс</Text>
            <Text style={styles.balanceValue}>
              {balance.toLocaleString("ru-RU")} ₽
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Цели */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Цели</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate("AddGoal")}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Нет целей</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate("AddGoal")}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Добавить первую цель</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((goal) => {
            const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalTop}>
                  <View style={styles.goalIcon}>
                    <Ionicons name="flag-outline" size={20} color={theme.accentMuted} />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
                    <Text style={styles.goalAmounts}>
                      {goal.currentAmount.toLocaleString("ru-RU")} ₽ / {goal.targetAmount.toLocaleString("ru-RU")} ₽
                    </Text>
                  </View>
                  <Text style={[styles.goalPercent, percent >= 100 && styles.goalPercentComplete]}>
                    {percent}%
                  </Text>
                </View>
                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.income : theme.accentMuted },
                    ]}
                  />
                </View>
                {/* Actions */}
                <View style={styles.goalActions}>
                  <TouchableOpacity
                    style={styles.goalActionBtn}
                    onPress={() => navigation.navigate("GoalAmount", { goal, type: "subtract" })}
                  >
                    <Ionicons name="remove" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.goalActionBtn, styles.goalActionBtnPrimary]}
                    onPress={() => navigation.navigate("GoalAmount", { goal, type: "add" })}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.goalActionBtn}
                    onPress={() => navigation.navigate("AddGoal", { goal })}
                  >
                    <Ionicons name="pencil-outline" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.goalActionBtn, styles.goalActionBtnDanger]}
                    onPress={() => handleGoalDelete(goal)}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.expense} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Настройки */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Настройки</Text>
        <View style={styles.settingsList}>
          <TouchableOpacity style={styles.settingsItem} onPress={() => navigation.navigate("EditProfile")}>
            <View style={styles.settingsItemIcon}>
              <Ionicons name="person-outline" size={18} color={theme.accentMuted} />
            </View>
            <View style={styles.settingsItemContent}>
              <Text style={styles.settingsItemTitle}>Данные профиля</Text>
              <Text style={styles.settingsItemSubtitle}>
                {displayName}{formattedDate ? ` • ${formattedDate}` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsItem, styles.settingsItemLast]}>
            <View style={styles.settingsItemIcon}>
              <Ionicons name="bulb-outline" size={18} color={theme.accentMuted} />
            </View>
            <View style={styles.settingsItemContent}>
              <Text style={styles.settingsItemTitle}>Тема оформления</Text>
              <Text style={styles.settingsItemSubtitle}>Светлая</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Кнопка выхода */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert("Выйти?", "Выйти из аккаунта?", [
            { text: "Отмена", style: "cancel" },
            { text: "Выйти", style: "destructive", onPress: () => logout() },
          ]);
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={theme.expense} />
        <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBase },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: theme.textPrimary, marginBottom: 12 },

  // Add button
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accentMuted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  // Balance card
  balanceCard: {
    borderRadius: theme.radius2xl,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: theme.shadowLg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radiusLg,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  balanceInfo: { flex: 1 },
  balanceLabel: { fontSize: 14, fontWeight: "500", color: "rgba(255, 255, 255, 0.85)", marginBottom: 4 },
  balanceValue: { fontSize: 28, fontWeight: "700", color: "#fff" },

  // Empty card
  emptyCard: {
    backgroundColor: theme.bgCard,
    borderRadius: theme.radius2xl,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.border,
  },
  emptyText: { fontSize: 15, color: theme.textSecondary, marginBottom: 16 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.accentMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radiusMd,
  },
  emptyBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  // Goals
  goalCard: {
    backgroundColor: theme.bgCard,
    borderRadius: theme.radius2xl,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.shadowSm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  goalTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radiusLg,
    backgroundColor: theme.accentMutedLight,
    justifyContent: "center",
    alignItems: "center",
  },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 16, fontWeight: "600", color: theme.textPrimary, marginBottom: 2 },
  goalAmounts: { fontSize: 13, color: theme.textSecondary },
  goalPercent: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
  goalPercentComplete: { color: theme.income },
  progressBar: {
    height: 8,
    backgroundColor: theme.bgSurface,
    borderRadius: 4,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  goalActions: { flexDirection: "row", gap: 8 },
  goalActionBtn: {
    flex: 1,
    height: 36,
    backgroundColor: theme.bgSurface,
    borderRadius: theme.radiusMd,
    justifyContent: "center",
    alignItems: "center",
  },
  goalActionBtnPrimary: { backgroundColor: theme.accentMuted },
  goalActionBtnDanger: { backgroundColor: theme.expenseLight },

  // Settings
  settingsList: {
    backgroundColor: theme.bgCard,
    borderRadius: theme.radius2xl,
    overflow: "hidden",
    shadowColor: theme.shadowSm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingsItemLast: { borderBottomWidth: 0 },
  settingsItemIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radiusLg,
    backgroundColor: theme.accentMutedLight,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsItemContent: { flex: 1 },
  settingsItemTitle: { fontSize: 16, fontWeight: "500", color: theme.textPrimary, marginBottom: 2 },
  settingsItemSubtitle: { fontSize: 13, color: theme.textSecondary },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.expense,
    borderRadius: theme.radius2xl,
    backgroundColor: "transparent",
  },
  logoutBtnText: { fontSize: 16, fontWeight: "500", color: theme.expense },
});
