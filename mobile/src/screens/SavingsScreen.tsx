import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, AppState, AppStateStatus } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useTheme } from "../context";
import { usePreserveScrollOnThemeChange } from "../hooks";
import { ConfirmModal } from "../components";
import type { Saving } from "@finance-assistant/shared";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

interface GroupedData { date: string; savings: Saving[]; totalAmount: number; }

export default function SavingsScreen({ navigation }: any) {
  const { api } = useAuth();
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollRef, onScroll, scrollEventThrottle } = usePreserveScrollOnThemeChange(mode);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; id: string | null }>({ visible: false, id: null });

  const load = useCallback(async () => {
    try {
      const [savingsData, transactionsData] = await Promise.all([api.getSavings(), api.getTransactions().catch(() => [])]);
      setSavings(savingsData);
      setTransactions(transactionsData);
    } catch { setSavings([]); setTransactions([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") load();
    });
    return () => sub.remove();
  }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.id) return;
    try {
      await api.deleteSaving(deleteModal.id);
      setSavings((prev) => prev.filter((s) => s.id !== deleteModal.id));
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось удалить"); }
    finally { setDeleteModal({ visible: false, id: null }); }
  };

  const totalSavings = useMemo(() => savings.reduce((sum, s) => sum + s.amount, 0), [savings]);
  const totalIncome = useMemo(() => transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0), [transactions]);
  const totalBalance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);
  const savingsPercentage = useMemo(() => (totalIncome === 0 ? 0 : (totalSavings / totalIncome) * 100), [totalSavings, totalIncome]);

  const filteredSavings = useMemo(() => {
    if (!searchQuery.trim()) return savings;
    const query = searchQuery.toLowerCase();
    return savings.filter((s) => s.description?.toLowerCase().includes(query));
  }, [savings, searchQuery]);

  const groupedData: GroupedData[] = useMemo(() => {
    const groups: Record<string, { savings: Saving[]; totalAmount: number }> = {};
    const sorted = [...filteredSavings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    sorted.forEach((s) => {
      const dateKey = s.date.split("T")[0];
      if (!groups[dateKey]) groups[dateKey] = { savings: [], totalAmount: 0 };
      groups[dateKey].savings.push(s);
      groups[dateKey].totalAmount += s.amount;
    });
    return Object.entries(groups).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime()).map(([date, data]) => ({ date, ...data }));
  }, [filteredSavings]);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 24;
  const listBottomPadding = 80 + bottomInset;
  const fabBottom = 16 + bottomInset;

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: { paddingHorizontal: 16, paddingBottom: listBottomPadding },
    emptyWithHeader: { paddingHorizontal: 16, paddingBottom: listBottomPadding },
    emptyText: { fontSize: 16, color: theme.textSecondary, textAlign: "center", paddingVertical: 60 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 16, marginBottom: 16, rowGap: 12 },
    statCard: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.bgCard, borderRadius: theme.radiusLg, padding: 12, shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
    statIcon: { width: 36, height: 36, borderRadius: theme.radiusMd, justifyContent: "center", alignItems: "center" },
    statIconOrange: { backgroundColor: theme.warningLight },
    statIconGreen: { backgroundColor: theme.incomeLight },
    statIconBlue: { backgroundColor: theme.accentMutedLight },
    statIconPurple: { backgroundColor: theme.purpleLight },
    statInfo: { flex: 1 },
    statLabel: { fontSize: 11, color: theme.textSecondary, marginBottom: 2 },
    statValue: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },
    statPositive: { color: theme.income },
    statNegative: { color: theme.expense },
    searchContainer: { flexDirection: "row", marginBottom: 12, gap: 12 },
    searchInput: { flex: 1, height: 48, backgroundColor: theme.bgCard, borderRadius: theme.radiusXl, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, fontSize: 15, color: theme.textPrimary },
    searchBtn: { width: 48, height: 48, backgroundColor: theme.bgCard, borderRadius: theme.radiusXl, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center" },
    dateGroup: { marginBottom: 8 },
    dateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
    dateLabelContainer: { backgroundColor: theme.bgSurface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radiusXl },
    dateLabel: { fontSize: 13, fontWeight: "500", color: theme.textSecondary },
    dateBalance: { fontSize: 13, fontWeight: "600", color: theme.income },
    savingItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
    savingIcon: { width: 48, height: 48, borderRadius: theme.radiusLg, backgroundColor: theme.incomeLight, justifyContent: "center", alignItems: "center" },
    savingInfo: { flex: 1 },
    savingName: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 4 },
    savingMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    savingTag: { backgroundColor: theme.bgSurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radiusSm },
    savingTagText: { fontSize: 11, color: theme.textTertiary },
    savingRight: { alignItems: "flex-end", marginRight: 8 },
    savingAmount: { fontSize: 15, fontWeight: "600", color: theme.income, marginBottom: 4 },
    savingTime: { fontSize: 12, color: theme.textTertiary },
    deleteBtn: { width: 36, height: 36, borderRadius: theme.radiusMd, justifyContent: "center", alignItems: "center" },
    fab: { position: "absolute", bottom: fabBottom, alignSelf: "center", width: 56, height: 56, borderRadius: theme.radiusXl, backgroundColor: theme.accentMuted, justifyContent: "center", alignItems: "center", shadowColor: theme.shadowLg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4 },
  }), [theme, fabBottom, listBottomPadding]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={theme.accentMuted} /></View>;
  }

  const renderSaving = (item: Saving) => (
    <View key={item.id} style={styles.savingItem}>
      <View style={styles.savingIcon}><Ionicons name="wallet-outline" size={20} color={theme.income} /></View>
      <View style={styles.savingInfo}>
        <Text style={styles.savingName} numberOfLines={1}>{item.description || "Накопление"}</Text>
        <View style={styles.savingMeta}><View style={styles.savingTag}><Text style={styles.savingTagText}>Сбережение</Text></View></View>
      </View>
      <View style={styles.savingRight}>
        <Text style={styles.savingAmount}>+ ₽{item.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.savingTime}>{formatTime(item.date)}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteModal({ visible: true, id: item.id })}>
        <Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderGroup = ({ item }: { item: GroupedData }) => (
    <View style={styles.dateGroup}>
      <View style={styles.dateHeader}>
        <View style={styles.dateLabelContainer}><Text style={styles.dateLabel}>{formatDate(item.date)}</Text></View>
        <Text style={styles.dateBalance}>+ ₽{item.totalAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
      </View>
      {item.savings.map(renderSaving)}
    </View>
  );

  const ListHeader = () => (
    <View>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.statIconOrange]}><Ionicons name="wallet-outline" size={18} color={theme.warning} /></View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Баланс</Text>
            <Text style={[styles.statValue, totalBalance >= 0 ? styles.statPositive : styles.statNegative]}>₽{totalBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.statIconGreen]}><Ionicons name="trending-up" size={18} color={theme.income} /></View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Накоплено</Text>
            <Text style={[styles.statValue, styles.statPositive]}>₽{totalSavings.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.statIconBlue]}><Ionicons name="pie-chart-outline" size={18} color={theme.accentMuted} /></View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>% от дохода</Text>
            <Text style={styles.statValue}>{savingsPercentage.toFixed(1)}%</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.statIconPurple]}><Ionicons name="time-outline" size={18} color={theme.purple} /></View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Записей</Text>
            <Text style={styles.statValue}>{savings.length}</Text>
          </View>
        </View>
      </View>
      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Поиск по описанию" placeholderTextColor={theme.textTertiary} value={searchQuery} onChangeText={setSearchQuery} />
        <TouchableOpacity style={styles.searchBtn}><Ionicons name="search" size={18} color={theme.textPrimary} /></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        data={groupedData}
        keyExtractor={(item) => item.date}
        renderItem={renderGroup}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={groupedData.length === 0 ? styles.emptyWithHeader : styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? "Ничего не найдено" : "Нет накоплений"}</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("AddSaving")}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <ConfirmModal
        visible={deleteModal.visible}
        title="Удалить накопление?"
        message="Это действие нельзя отменить."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ visible: false, id: null })}
      />
    </View>
  );
}
