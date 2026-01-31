import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useAuth, useTheme } from "../context";
import { ConfirmModal } from "../components";
import type { Category } from "@finance-assistant/shared";

const DEFAULT_NAMES = ["Продукты", "Транспорт", "Развлечения", "Здоровье", "Одежда", "Жилье", "Зарплата", "Другое"];

export default function CategoriesScreen({ navigation }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; id: string | null; name: string }>({ visible: false, id: null, name: "" });

  const load = useCallback(async () => {
    try { const data = await api.getCategories(); setCategories(data); }
    catch { setCategories([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api]);

  useEffect(() => { load(); }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteModal.id) return;
    try {
      await api.deleteCategory(deleteModal.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteModal.id));
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось удалить категорию"); }
    finally { setDeleteModal({ visible: false, id: null, name: "" }); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    emptyText: { fontSize: 16, color: theme.textSecondary },
    row: { flexDirection: "row", alignItems: "center", backgroundColor: theme.bgCard, padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: theme.radiusLg, shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
    colorDot: { width: 20, height: 20, borderRadius: 10, marginRight: 12 },
    rowName: { flex: 1, fontSize: 16, color: theme.textPrimary },
    delBtn: { paddingVertical: 4, paddingHorizontal: 8 },
    delBtnText: { fontSize: 14, color: theme.expense },
    addBtn: { margin: 16, backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingVertical: 14, minHeight: theme.btnHeight, justifyContent: "center", alignItems: "center" },
    addBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  }), [theme]);

  const CategoryRow = ({ item }: { item: Category }) => {
    const canDelete = !DEFAULT_NAMES.includes(item.name);
    return (
      <View style={styles.row}>
        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        {canDelete && (
          <TouchableOpacity style={styles.delBtn} onPress={() => setDeleteModal({ visible: true, id: item.id, name: item.name })}>
            <Text style={styles.delBtnText}>Удалить</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={theme.accentMuted} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CategoryRow item={item} />}
        contentContainerStyle={categories.length === 0 ? styles.emptyWrap : undefined}
        ListEmptyComponent={<Text style={styles.emptyText}>Нет категорий</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      />
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate("AddCategory")}>
        <Text style={styles.addBtnText}>Добавить категорию</Text>
      </TouchableOpacity>
      <ConfirmModal
        visible={deleteModal.visible}
        title="Удалить категорию?"
        message={`Удалить «${deleteModal.name}»?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ visible: false, id: null, name: "" })}
      />
    </View>
  );
}
