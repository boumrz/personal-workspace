import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, AppState, AppStateStatus } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useAuth, useTheme } from "../context";
import { usePreserveScrollOnThemeChange } from "../hooks";
import { ConfirmModal } from "../components";
import { getIoniconsName } from "../utils/iconMap";
import type { Transaction } from "@finance-assistant/shared";

dayjs.locale("ru");

type TabType = "actual" | "planned";

function formatDate(dateStr: string) {
  const date = dayjs(dateStr);
  const today = dayjs();
  const yesterday = today.subtract(1, "day");
  if (date.isSame(today, "day")) return "Сегодня";
  if (date.isSame(yesterday, "day")) return "Вчера";
  return date.format("D MMMM YYYY");
}

function formatMonth(dateStr: string) {
  return dayjs(dateStr).format("MMMM YYYY");
}

function formatTime(dateStr: string) {
  return dayjs(dateStr).format("HH:mm");
}

interface GroupedData { date: string; transactions: Transaction[]; totalBalance: number; }

export default function TransactionsScreen({ navigation }: any) {
  const { api } = useAuth();
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollRef, onScroll, scrollEventThrottle } = usePreserveScrollOnThemeChange(mode);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("actual");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; id: string | null }>({ visible: false, id: null });

  const load = useCallback(async () => {
    try {
      const [transData, plannedData] = await Promise.all([
        api.getTransactions(),
        api.getPlannedExpenses?.().catch(() => []) ?? Promise.resolve([]),
      ]);
      setTransactions(transData);
      setPlannedExpenses(plannedData);
    } catch { setTransactions([]); setPlannedExpenses([]); }
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
      if (activeTab === "actual") {
        await api.deleteTransaction(deleteModal.id);
        setTransactions((prev) => prev.filter((t) => t.id !== deleteModal.id));
      } else {
        await api.deletePlannedExpense?.(deleteModal.id);
        setPlannedExpenses((prev) => prev.filter((t) => t.id !== deleteModal.id));
      }
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось удалить"); }
    finally { setDeleteModal({ visible: false, id: null }); }
  };

  const currentData = activeTab === "actual" ? transactions : plannedExpenses;

  const filteredData = useMemo(() => {
    let filtered = currentData;
    if (!selectedCategories.includes("all") && selectedCategories.length > 0) {
      filtered = filtered.filter((t) => selectedCategories.includes(t.category.id));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.description?.toLowerCase().includes(query) || t.category.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [currentData, selectedCategories, searchQuery]);

  const groupedData: GroupedData[] = useMemo(() => {
    const groups: Record<string, { transactions: Transaction[]; totalBalance: number }> = {};
    const sorted = [...filteredData].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
    
    sorted.forEach((t) => {
      // Для планируемых трат группируем по месяцу, для актуальных — по дате
      const dateKey = activeTab === "planned" 
        ? dayjs(t.date).format("YYYY-MM") // Группировка по месяцу
        : t.date.split("T")[0];            // Группировка по дате
      
      if (!groups[dateKey]) groups[dateKey] = { transactions: [], totalBalance: 0 };
      groups[dateKey].transactions.push(t);
      groups[dateKey].totalBalance += t.type === "income" ? t.amount : -t.amount;
    });
    
    return Object.entries(groups)
      .sort(([a], [b]) => dayjs(b).valueOf() - dayjs(a).valueOf())
      .map(([date, data]) => ({ date, ...data }));
  }, [filteredData, activeTab]);

  const openFilter = () => {
    navigation.navigate("CategoryFilter", { selectedCategories, onApply: (newSelected: string[]) => setSelectedCategories(newSelected) });
  };

  const hasActiveFilter = !selectedCategories.includes("all");
  const filterCount = hasActiveFilter ? selectedCategories.length : 0;

  const bottomInset = insets.bottom > 0 ? insets.bottom : 24;
  const listBottomPadding = 80 + bottomInset;
  const fabBottom = 16 + bottomInset;

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: { paddingHorizontal: 16, paddingBottom: listBottomPadding },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    emptyText: { fontSize: 16, color: theme.textSecondary },
    tabsContainer: { flexDirection: "row", margin: 16, padding: 4, backgroundColor: theme.bgSurface, borderRadius: theme.radiusXl },
    tab: { flex: 1, paddingVertical: 10, borderRadius: theme.radiusLg, alignItems: "center" },
    tabActive: { backgroundColor: theme.bgCard, shadowColor: theme.shadowMd, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: "500", color: theme.textSecondary },
    tabTextActive: { color: theme.textPrimary },
    searchContainer: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, gap: 12 },
    searchInput: { flex: 1, height: 48, backgroundColor: theme.bgCard, borderRadius: theme.radiusXl, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, fontSize: 15, color: theme.textPrimary, paddingVertical: 12 },
    searchBtn: { width: 48, height: 48, backgroundColor: theme.bgCard, borderRadius: theme.radiusXl, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center" },
    filterBtn: { width: 48, height: 48, backgroundColor: theme.bgCard, borderRadius: theme.radiusXl, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center", position: "relative" },
    filterBadge: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: theme.accent, justifyContent: "center", alignItems: "center" },
    filterBadgeText: { fontSize: 10, fontWeight: "600", color: "#fff" },
    dateGroup: { marginBottom: 8 },
    dateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
    dateLabelContainer: { backgroundColor: theme.bgSurface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radiusXl },
    dateLabel: { fontSize: 13, fontWeight: "500", color: theme.textSecondary },
    dateBalanceText: { fontSize: 13, fontWeight: "600" },
    balancePositive: { color: theme.income },
    balanceNegative: { color: theme.expense },
    transactionItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
    transactionIcon: { width: 48, height: 48, borderRadius: theme.radiusLg, justifyContent: "center", alignItems: "center" },
    transactionInfo: { flex: 1 },
    transactionName: { fontSize: 15, fontWeight: "600", color: theme.textPrimary, marginBottom: 4 },
    transactionMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    transactionCategory: { fontSize: 13, color: theme.textSecondary },
    transactionTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radiusSm },
    tagIncome: { backgroundColor: theme.incomeLight },
    tagExpense: { backgroundColor: theme.expenseLight },
    transactionTagText: { fontSize: 11 },
    tagTextIncome: { color: theme.income },
    tagTextExpense: { color: theme.expense },
    transactionRight: { alignItems: "flex-end", marginRight: 8 },
    transactionAmount: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
    amountIncome: { color: theme.income },
    amountExpense: { color: theme.expense },
    transactionTime: { fontSize: 12, color: theme.textTertiary },
    deleteBtn: { width: 36, height: 36, borderRadius: theme.radiusMd, justifyContent: "center", alignItems: "center" },
    fab: { position: "absolute", bottom: fabBottom, alignSelf: "center", width: 56, height: 56, borderRadius: theme.radiusXl, backgroundColor: theme.accentMuted, justifyContent: "center", alignItems: "center", shadowColor: theme.shadowLg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4 },
  }), [theme, fabBottom, listBottomPadding]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={theme.accentMuted} /></View>;
  }

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === "income";
    const categoryColor = item.category.color || theme.textSecondary;
    const categoryIcon = getIoniconsName(item.category.icon);
    return (
      <View style={styles.transactionItem}>
        <View style={[styles.transactionIcon, { backgroundColor: categoryColor + "20" }]}>
          <Ionicons name={categoryIcon} size={22} color={categoryColor} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionName} numberOfLines={1}>{item.description || "Без описания"}</Text>
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionCategory}>{item.category.name}</Text>
            <View style={[styles.transactionTag, isIncome ? styles.tagIncome : styles.tagExpense]}>
              <Text style={[styles.transactionTagText, isIncome ? styles.tagTextIncome : styles.tagTextExpense]}>
                {activeTab === "planned" ? "План" : isIncome ? "Доход" : "Расход"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, isIncome ? styles.amountIncome : styles.amountExpense]}>
            {activeTab === "planned" ? "" : isIncome ? "+ " : "- "}₽{item.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
          </Text>
          {activeTab !== "planned" && <Text style={styles.transactionTime}>{formatTime(item.date)}</Text>}
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteModal({ visible: true, id: item.id })}>
          <Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderGroup = ({ item }: { item: GroupedData }) => {
    // Для планируемых трат показываем месяц, для актуальных — дату
    const dateLabel = activeTab === "planned" ? formatMonth(item.date) : formatDate(item.date);
    
    return (
      <View style={styles.dateGroup}>
        <View style={styles.dateHeader}>
          <View style={styles.dateLabelContainer}>
            <Text style={[styles.dateLabel, { textTransform: "capitalize" }]}>{dateLabel}</Text>
          </View>
          <Text style={[styles.dateBalanceText, item.totalBalance >= 0 ? styles.balancePositive : styles.balanceNegative]}>
            {activeTab === "planned" ? "Σ" : item.totalBalance >= 0 ? "△" : "▽"} ₽{Math.abs(item.totalBalance).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        {item.transactions.map((t) => <View key={t.id}>{renderTransaction({ item: t })}</View>)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === "actual" && styles.tabActive]} onPress={() => setActiveTab("actual")}>
          <Text style={[styles.tabText, activeTab === "actual" && styles.tabTextActive]}>Актуальные</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "planned" && styles.tabActive]} onPress={() => setActiveTab("planned")}>
          <Text style={[styles.tabText, activeTab === "planned" && styles.tabTextActive]}>Планируемые</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Поиск по описанию" placeholderTextColor={theme.textTertiary} value={searchQuery} onChangeText={setSearchQuery} numberOfLines={1} />
        <TouchableOpacity style={styles.searchBtn}><Ionicons name="search" size={18} color={theme.textPrimary} /></TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={openFilter}>
          <Ionicons name="funnel-outline" size={18} color={theme.textPrimary} />
          {filterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{filterCount}</Text></View>}
        </TouchableOpacity>
      </View>

      <FlatList
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        data={groupedData}
        keyExtractor={(item) => item.date}
        renderItem={renderGroup}
        contentContainerStyle={groupedData.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? "Ничего не найдено" : activeTab === "actual" ? "Нет операций" : "Нет планируемых расходов"}</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("AddTransaction", { mode: activeTab })}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <ConfirmModal
        visible={deleteModal.visible}
        title={activeTab === "actual" ? "Удалить операцию?" : "Удалить планируемый расход?"}
        message="Это действие нельзя отменить."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ visible: false, id: null })}
      />
    </View>
  );
}
