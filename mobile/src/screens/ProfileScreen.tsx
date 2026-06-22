import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Switch, AppState, AppStateStatus, Modal, TextInput, NativeModules } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useTheme } from "../context";
import { usePreserveScrollOnThemeChange } from "../hooks";
import { ConfirmModal, ErrorView } from "../components";
import { VK_ID_APP_ID } from "../constants/config";
import { getVkIdAccessToken } from "../services/vkIdAuth";
import type { Profile, Goal } from "@finance-assistant/shared";

const VkIdNative = NativeModules.VkIdModule as
  | { login: () => Promise<string> }
  | undefined;

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
  const [unlinkVkModal, setUnlinkVkModal] = useState(false);
  const [setPasswordModalVisible, setSetPasswordModalVisible] = useState(false);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [linkVkLoading, setLinkVkLoading] = useState(false);
  const [unlinkVkLoading, setUnlinkVkLoading] = useState(false);
  const [newLoginValue, setNewLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirmValue, setPasswordConfirmValue] = useState("");
  const [error, setError] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
        }
        retryTimer.current = setTimeout(loadData, 300);
      }
    });
    return () => {
      sub.remove();
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    };
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

  const canUnlinkVk = (profile?.authMethodsCount ?? 0) > 1;

  const onVkLink = async () => {
    if (!VK_ID_APP_ID) {
      Alert.alert(
        "VK ID не настроен",
        "Добавьте EXPO_PUBLIC_VK_ID_APP_ID в mobile/.env или EAS secrets.",
      );
      return;
    }
    try {
      setLinkVkLoading(true);
      const accessToken = await getVkIdAccessToken({
        appId: VK_ID_APP_ID,
        nativeLogin: VkIdNative?.login,
      });
      await api.linkVkId({ access_token: accessToken, app_id: VK_ID_APP_ID });
      Alert.alert("Успешно", "VK привязан");
      await loadData();
    } catch (e: any) {
      Alert.alert("Ошибка привязки VK", e?.message || "Не удалось привязать VK ID");
    } finally {
      setLinkVkLoading(false);
    }
  };

  const onVkUnlinkPress = () => {
    if (!canUnlinkVk) {
      Alert.alert(
        "Нельзя отвязать VK",
        "Чтобы отвязать VK, сначала добавьте пароль. Иначе вы не сможете войти в аккаунт.",
        [
          { text: "Отмена", style: "cancel" },
          { text: "Добавить пароль", onPress: () => setSetPasswordModalVisible(true) },
        ],
      );
      return;
    }
    setUnlinkVkModal(true);
  };

  const onVkUnlinkConfirm = async () => {
    try {
      setUnlinkVkLoading(true);
      await api.unlinkVk();
      setUnlinkVkModal(false);
      Alert.alert("Успешно", "VK отвязан");
      await loadData();
    } catch (e: any) {
      Alert.alert("Ошибка отвязки", e?.message || "Не удалось отвязать VK");
    } finally {
      setUnlinkVkLoading(false);
    }
  };

  const closeSetPasswordModal = () => {
    setSetPasswordModalVisible(false);
    setNewLoginValue("");
    setPasswordValue("");
    setPasswordConfirmValue("");
  };

  const onSetPassword = async () => {
    const newLogin = newLoginValue.trim();
    const password = passwordValue.trim();
    const passwordConfirm = passwordConfirmValue.trim();
    if (!newLogin) {
      Alert.alert("Ошибка", "Введите логин");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newLogin)) {
      Alert.alert("Ошибка", "Логин может содержать только буквы, цифры и подчеркивание");
      return;
    }
    if (newLogin.length < 3) {
      Alert.alert("Ошибка", "Логин должен быть не менее 3 символов");
      return;
    }
    if (!password) {
      Alert.alert("Ошибка", "Введите пароль");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Ошибка", "Пароль должен быть не менее 6 символов");
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert("Ошибка", "Пароли не совпадают");
      return;
    }

    try {
      setSetPasswordLoading(true);
      await api.setPassword(password, newLogin);
      closeSetPasswordModal();
      Alert.alert("Успешно", "Логин и пароль сохранены");
      await loadData();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message || "Не удалось сохранить данные входа");
    } finally {
      setSetPasswordLoading(false);
    }
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
    linkedAccounts: { backgroundColor: theme.bgCard, borderRadius: theme.radius2xl, overflow: "hidden", shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
    linkedAccountItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    linkedAccountItemLast: { borderBottomWidth: 0 },
    linkedAccountInfo: { flex: 1 },
    linkedAccountName: { fontSize: 16, fontWeight: "600", color: theme.textPrimary, marginBottom: 2 },
    linkedAccountStatus: { fontSize: 13, color: theme.textSecondary },
    linkedActionBtn: { minWidth: 106, height: 36, borderRadius: theme.radiusMd, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, backgroundColor: theme.accentMuted },
    linkedActionBtnDanger: { backgroundColor: theme.expenseLight, borderWidth: 1, borderColor: theme.expense },
    linkedActionBtnDisabled: { opacity: 0.7 },
    linkedActionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    linkedActionBtnDangerText: { color: theme.expense, fontSize: 14, fontWeight: "600" },
    securityCard: { backgroundColor: theme.bgCard, borderRadius: theme.radius2xl, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
    securityInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
    securityText: { fontSize: 15, color: theme.textPrimary, fontWeight: "500" },
    securityHint: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    securityBtn: { backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingHorizontal: 14, height: 36, justifyContent: "center", alignItems: "center" },
    securityBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
    modalCard: { width: "100%", maxWidth: 360, borderRadius: theme.radiusXl, backgroundColor: theme.bgCard, padding: 18, borderWidth: 1, borderColor: theme.border },
    modalTitle: { fontSize: 18, fontWeight: "700", color: theme.textPrimary, marginBottom: 8 },
    modalText: { fontSize: 14, lineHeight: 20, color: theme.textSecondary, marginBottom: 14 },
    modalLabel: { fontSize: 13, fontWeight: "600", color: theme.textPrimary, marginBottom: 6, marginTop: 6 },
    modalInput: { borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bgSurface, color: theme.textPrimary, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
    modalAction: { flex: 1, height: 40, borderRadius: theme.radiusMd, justifyContent: "center", alignItems: "center" },
    modalCancel: { backgroundColor: theme.bgSurface, borderWidth: 1, borderColor: theme.border },
    modalConfirm: { backgroundColor: theme.accentMuted },
    modalCancelText: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
    modalConfirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
          <TouchableOpacity style={dynamicStyles.settingsItem} onPress={() => navigation.navigate("DataTools")}>
            <View style={dynamicStyles.settingsItemIcon}><Ionicons name="layers-outline" size={18} color={theme.accentMuted} /></View>
            <View style={dynamicStyles.settingsItemContent}>
              <Text style={dynamicStyles.settingsItemTitle}>Инструменты данных</Text>
              <Text style={dynamicStyles.settingsItemSubtitle}>Экспорт, импорт и фото чека</Text>
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

      {!profile?.hasPassword && (
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Безопасность</Text>
          <View style={dynamicStyles.securityCard}>
            <View style={dynamicStyles.securityInfo}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.accentMuted} />
              <View>
                <Text style={dynamicStyles.securityText}>Пароль не установлен</Text>
                <Text style={dynamicStyles.securityHint}>Добавьте пароль для входа по логину и паролю</Text>
              </View>
            </View>
            <TouchableOpacity style={dynamicStyles.securityBtn} onPress={() => setSetPasswordModalVisible(true)}>
              <Text style={dynamicStyles.securityBtnText}>Добавить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Привязанные аккаунты</Text>
        <View style={dynamicStyles.linkedAccounts}>
          <View style={[dynamicStyles.linkedAccountItem, dynamicStyles.linkedAccountItemLast]}>
            <View style={dynamicStyles.linkedAccountInfo}>
              <Text style={dynamicStyles.linkedAccountName}>VK</Text>
              <Text style={dynamicStyles.linkedAccountStatus}>
                {profile?.vkId ? "Привязан" : "Не привязан"}
              </Text>
            </View>
            {profile?.vkId ? (
              <TouchableOpacity
                style={[
                  dynamicStyles.linkedActionBtn,
                  dynamicStyles.linkedActionBtnDanger,
                  unlinkVkLoading && dynamicStyles.linkedActionBtnDisabled,
                ]}
                onPress={onVkUnlinkPress}
                disabled={unlinkVkLoading}
              >
                {unlinkVkLoading ? (
                  <ActivityIndicator size="small" color={theme.expense} />
                ) : (
                  <Text style={dynamicStyles.linkedActionBtnDangerText}>Отвязать</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  dynamicStyles.linkedActionBtn,
                  linkVkLoading && dynamicStyles.linkedActionBtnDisabled,
                ]}
                onPress={onVkLink}
                disabled={linkVkLoading}
              >
                {linkVkLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={dynamicStyles.linkedActionBtnText}>Привязать VK</Text>
                )}
              </TouchableOpacity>
            )}
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
      <ConfirmModal
        visible={unlinkVkModal}
        title="Отвязать VK?"
        message="Вы сможете войти через VK снова, только привязав его заново."
        confirmText="Отвязать"
        onConfirm={onVkUnlinkConfirm}
        onCancel={() => setUnlinkVkModal(false)}
      />
      <Modal visible={setPasswordModalVisible} transparent animationType="fade" onRequestClose={closeSetPasswordModal}>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>Добавить пароль</Text>
            <Text style={dynamicStyles.modalText}>
              Задайте новый логин и пароль. После этого вы сможете входить без VK.
            </Text>
            <Text style={dynamicStyles.modalLabel}>Логин</Text>
            <TextInput
              style={dynamicStyles.modalInput}
              value={newLoginValue}
              onChangeText={setNewLoginValue}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Например: ivan_123"
              placeholderTextColor={theme.textTertiary}
            />
            <Text style={dynamicStyles.modalLabel}>Пароль</Text>
            <TextInput
              style={dynamicStyles.modalInput}
              value={passwordValue}
              onChangeText={setPasswordValue}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Минимум 6 символов"
              placeholderTextColor={theme.textTertiary}
            />
            <Text style={dynamicStyles.modalLabel}>Подтвердите пароль</Text>
            <TextInput
              style={dynamicStyles.modalInput}
              value={passwordConfirmValue}
              onChangeText={setPasswordConfirmValue}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Повторите пароль"
              placeholderTextColor={theme.textTertiary}
            />
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={[dynamicStyles.modalAction, dynamicStyles.modalCancel]} onPress={closeSetPasswordModal}>
                <Text style={dynamicStyles.modalCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.modalAction, dynamicStyles.modalConfirm]}
                onPress={onSetPassword}
                disabled={setPasswordLoading}
              >
                {setPasswordLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={dynamicStyles.modalConfirmText}>Установить</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
