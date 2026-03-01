import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Switch, AppState, AppStateStatus } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useTheme } from "../context";
import { usePreserveScrollOnThemeChange } from "../hooks";
import { ConfirmModal, ErrorView } from "../components";
import type { Profile, Goal } from "@finance-assistant/shared";

export default function ProfileScreen({ navigation }: any) {
  const { api, logout } = useAuth();
  const { theme, mode, toggleTheme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollRef, onScroll, scrollEventThrottle } = usePreserveScrollOnThemeChange(mode);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; goal: Goal | null }>({ visible: false, goal: null });
  const [logoutModal, setLogoutModal] = useState(false);
  const [error, setError] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();

  const balance = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return income - expense;
  }, [transactions]);

  const loadData = useCallback(async () => {
    setError(false);
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
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(loadData, 300);
      }
    });
    return () => { sub.remove(); clearTimeout(retryTimer.current); };
  }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleGoalDeleteConfirm = async () => {
    if (!deleteModal.goal) return;
    try {
      await api.deleteGoal(deleteModal.goal.id);
      setGoals((prev) => prev.filter((g) => g.id !== deleteModal.goal?.id));
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось удалить цель"); }
    finally { setDeleteModal({ visible: false, goal: null }); }
  };

  const displayName = useMemo(() => {
    if (profile?.firstName) return profile.firstName;
    if (profile?.name) return profile.name.split(" ")[0];
    return "Пользователь";
  }, [profile]);

  const formattedDate = useMemo(() => {
    if (profile?.dateOfBirth) return new Date(profile.dateOfBirth).toLocaleDateString("ru-RU");
    return null;
  }, [profile]);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    content: { padding: 16, paddingBottom: Math.max(32, insets.bottom + 16) },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 22, fontWeight: "700", color: theme.textPrimary, marginBottom: 12 },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accentMuted, justifyContent: "center", alignItems: "center", marginBottom: 12 },
    balanceCard: { borderRadius: theme.radius2xl, padding: 24, flexDirection: "row", alignItems: "center", gap: 16, shadowColor: theme.shadowLg, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 24, elevation: 4 },
    balanceIcon: { width: 48, height: 48, borderRadius: theme.radiusLg, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
    balanceInfo: { flex: 1 },
    balanceLabel: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginBottom: 4 },
    balanceValue: { fontSize: 28, fontWeight: "700", color: "#fff" },
    emptyCard: { backgroundColor: theme.bgCard, borderRadius: theme.radius2xl, padding: 32, alignItems: "center", borderWidth: 2, borderStyle: "dashed", borderColor: theme.border },
    emptyText: { fontSize: 15, color: theme.textSecondary, marginBottom: 16 },
    emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.accentMuted, paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radiusMd },
    emptyBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
    goalCard: { backgroundColor: theme.bgCard, borderRadius: theme.radius2xl, padding: 16, marginBottom: 12, shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
    goalTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    goalIcon: { width: 44, height: 44, borderRadius: theme.radiusLg, backgroundColor: theme.accentMutedLight, justifyContent: "center", alignItems: "center" },
    goalInfo: { flex: 1 },
    goalTitle: { fontSize: 16, fontWeight: "600", color: theme.textPrimary, marginBottom: 2 },
    goalAmounts: { fontSize: 13, color: theme.textSecondary },
    goalPercent: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
    goalPercentComplete: { color: theme.income },
    progressBar: { height: 8, backgroundColor: theme.bgSurface, borderRadius: 4, marginBottom: 12, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4 },
    goalActions: { flexDirection: "row", gap: 8 },
    goalActionBtn: { flex: 1, height: 36, backgroundColor: theme.bgSurface, borderRadius: theme.radiusMd, justifyContent: "center", alignItems: "center" },
    goalActionBtnPrimary: { backgroundColor: theme.accentMuted },
    goalActionBtnDanger: { backgroundColor: theme.expenseLight },
    settingsList: { backgroundColor: theme.bgCard, borderRadius: theme.radius2xl, overflow: "hidden", shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
    settingsItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
    settingsItemLast: { borderBottomWidth: 0 },
    settingsItemIcon: { width: 40, height: 40, borderRadius: theme.radiusLg, backgroundColor: theme.accentMutedLight, justifyContent: "center", alignItems: "center" },
    settingsItemContent: { flex: 1 },
    settingsItemTitle: { fontSize: 16, fontWeight: "500", color: theme.textPrimary, marginBottom: 2 },
    settingsItemSubtitle: { fontSize: 13, color: theme.textSecondary },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, marginTop: 8, borderWidth: 1, borderColor: theme.expense, borderRadius: theme.radius2xl, backgroundColor: "transparent" },
    logoutBtnText: { fontSize: 16, fontWeight: "500", color: theme.expense },
  }), [theme, insets.bottom]);

  if (loading) {
    return <View style={dynamicStyles.centered}><ActivityIndicator size="large" color={theme.accentMuted} /></View>;
  }

  if (error && !profile) {
    return (
      <View style={dynamicStyles.container}>
        <ErrorView onRetry={loadData} />
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} style={dynamicStyles.container} contentContainerStyle={dynamicStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Кошелёк</Text>
        <LinearGradient colors={[theme.incomeMutedDark, theme.incomeMutedDarker]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dynamicStyles.balanceCard}>
          <View style={dynamicStyles.balanceIcon}><Ionicons name="wallet-outline" size={24} color="#fff" /></View>
          <View style={dynamicStyles.balanceInfo}>
            <Text style={dynamicStyles.balanceLabel}>Баланс</Text>
            <Text style={dynamicStyles.balanceValue}>{balance.toLocaleString("ru-RU")} ₽</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.sectionHeader}>
          <Text style={dynamicStyles.sectionTitle}>Цели</Text>
          <TouchableOpacity style={dynamicStyles.addBtn} onPress={() => navigation.navigate("AddGoal")}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
        </View>
        {goals.length === 0 ? (
          <View style={dynamicStyles.emptyCard}>
            <Text style={dynamicStyles.emptyText}>Нет целей</Text>
            <TouchableOpacity style={dynamicStyles.emptyBtn} onPress={() => navigation.navigate("AddGoal")}>
              <Ionicons name="add" size={18} color="#fff" /><Text style={dynamicStyles.emptyBtnText}>Добавить первую цель</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((goal) => {
            const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            return (
              <View key={goal.id} style={dynamicStyles.goalCard}>
                <View style={dynamicStyles.goalTop}>
                  <View style={dynamicStyles.goalIcon}><Ionicons name="flag-outline" size={20} color={theme.accentMuted} /></View>
                  <View style={dynamicStyles.goalInfo}>
                    <Text style={dynamicStyles.goalTitle} numberOfLines={1}>{goal.title}</Text>
                    <Text style={dynamicStyles.goalAmounts}>{goal.currentAmount.toLocaleString("ru-RU")} ₽ / {goal.targetAmount.toLocaleString("ru-RU")} ₽</Text>
                  </View>
                  <Text style={[dynamicStyles.goalPercent, percent >= 100 && dynamicStyles.goalPercentComplete]}>{percent}%</Text>
                </View>
                <View style={dynamicStyles.progressBar}>
                  <View style={[dynamicStyles.progressFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.income : theme.accentMuted }]} />
                </View>
                <View style={dynamicStyles.goalActions}>
                  <TouchableOpacity style={dynamicStyles.goalActionBtn} onPress={() => navigation.navigate("GoalAmount", { goal, type: "subtract" })}><Ionicons name="remove" size={18} color={theme.textSecondary} /></TouchableOpacity>
                  <TouchableOpacity style={[dynamicStyles.goalActionBtn, dynamicStyles.goalActionBtnPrimary]} onPress={() => navigation.navigate("GoalAmount", { goal, type: "add" })}><Ionicons name="add" size={18} color="#fff" /></TouchableOpacity>
                  <TouchableOpacity style={dynamicStyles.goalActionBtn} onPress={() => navigation.navigate("AddGoal", { goal })}><Ionicons name="pencil-outline" size={18} color={theme.textSecondary} /></TouchableOpacity>
                  <TouchableOpacity style={[dynamicStyles.goalActionBtn, dynamicStyles.goalActionBtnDanger]} onPress={() => setDeleteModal({ visible: true, goal })}><Ionicons name="trash-outline" size={18} color={theme.expense} /></TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Настройки</Text>
        <View style={dynamicStyles.settingsList}>
          <TouchableOpacity style={dynamicStyles.settingsItem} onPress={() => navigation.navigate("EditProfile")}>
            <View style={dynamicStyles.settingsItemIcon}><Ionicons name="person-outline" size={18} color={theme.accentMuted} /></View>
            <View style={dynamicStyles.settingsItemContent}>
              <Text style={dynamicStyles.settingsItemTitle}>Данные профиля</Text>
              <Text style={dynamicStyles.settingsItemSubtitle}>{displayName}{formattedDate ? ` • ${formattedDate}` : ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.settingsItem} onPress={() => navigation.navigate("PrivacyPolicy")}>
            <View style={dynamicStyles.settingsItemIcon}><Ionicons name="shield-checkmark-outline" size={18} color={theme.accentMuted} /></View>
            <View style={dynamicStyles.settingsItemContent}>
              <Text style={dynamicStyles.settingsItemTitle}>Политика конфиденциальности</Text>
              <Text style={dynamicStyles.settingsItemSubtitle}>Как мы обрабатываем ваши данные</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.settingsItem} onPress={() => navigation.navigate("Terms")}>
            <View style={dynamicStyles.settingsItemIcon}><Ionicons name="document-text-outline" size={18} color={theme.accentMuted} /></View>
            <View style={dynamicStyles.settingsItemContent}>
              <Text style={dynamicStyles.settingsItemTitle}>Условия использования</Text>
              <Text style={dynamicStyles.settingsItemSubtitle}>Правила использования приложения</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
          <View style={[dynamicStyles.settingsItem, dynamicStyles.settingsItemLast]}>
            <View style={dynamicStyles.settingsItemIcon}><Ionicons name={isDark ? "moon" : "sunny"} size={18} color={theme.accentMuted} /></View>
            <View style={dynamicStyles.settingsItemContent}>
              <Text style={dynamicStyles.settingsItemTitle}>Тёмная тема</Text>
              <Text style={dynamicStyles.settingsItemSubtitle}>{isDark ? "Включена" : "Выключена"}</Text>
            </View>
            <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: theme.bgSurface, true: theme.accent }} thumbColor="#fff" />
          </View>
        </View>
      </View>

      <TouchableOpacity style={dynamicStyles.logoutBtn} onPress={() => setLogoutModal(true)}>
        <Ionicons name="log-out-outline" size={20} color={theme.expense} />
        <Text style={dynamicStyles.logoutBtnText}>Выйти из аккаунта</Text>
      </TouchableOpacity>

      <ConfirmModal
        visible={deleteModal.visible}
        title="Удалить цель?"
        message="Это действие нельзя отменить."
        onConfirm={handleGoalDeleteConfirm}
        onCancel={() => setDeleteModal({ visible: false, goal: null })}
      />
      <ConfirmModal
        visible={logoutModal}
        title="Выйти?"
        message="Выйти из аккаунта?"
        confirmText="Выйти"
        onConfirm={() => { setLogoutModal(false); logout(); }}
        onCancel={() => setLogoutModal(false)}
      />
    </ScrollView>
  );
}
