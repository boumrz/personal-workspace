import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { useAuth, useTheme } from "../context";

const COLOR_PALETTE = [
  "#FF6B6B", "#E91E63", "#FF9800", "#FFC107", "#4CAF50", "#66BB6A",
  "#03A9F4", "#2196F3", "#9C27B0", "#00BCD4", "#607D8B", "#795548",
];

export default function AddCategoryScreen({ navigation }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert("Ошибка", "Введите название категории"); return; }
    setSaving(true);
    try {
      await api.createCategory({ name: trimmed, color: selectedColor, icon: "Package" });
      navigation.goBack();
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось создать категорию"); }
    finally { setSaving(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    content: { padding: 16, paddingBottom: 32 },
    label: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 8 },
    input: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 20, color: theme.textPrimary },
    colors: { flexDirection: "row", flexWrap: "wrap", marginBottom: 24, gap: 12 },
    colorBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "transparent" },
    colorBtnSelected: { borderColor: theme.textPrimary },
    saveBtn: { backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingVertical: 14, minHeight: theme.btnHeight, justifyContent: "center", alignItems: "center" },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  }), [theme]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Название</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Название категории" placeholderTextColor={theme.textTertiary} />

      <Text style={styles.label}>Цвет</Text>
      <View style={styles.colors}>
        {COLOR_PALETTE.map((color) => (
          <TouchableOpacity key={color} style={[styles.colorBtn, { backgroundColor: color }, selectedColor === color && styles.colorBtnSelected]} onPress={() => setSelectedColor(color)} />
        ))}
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "Сохранение…" : "Сохранить"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
