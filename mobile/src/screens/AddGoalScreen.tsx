import React, { useState, useMemo } from "react";
import { Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth, useTheme } from "../context";

export default function AddGoalScreen({ navigation, route }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const editingGoal = route.params?.goal;
  
  const [title, setTitle] = useState(editingGoal?.title ?? "");
  const [targetAmount, setTargetAmount] = useState(editingGoal?.targetAmount?.toString() ?? "");
  const [currentAmount, setCurrentAmount] = useState(editingGoal?.currentAmount?.toString() ?? "0");
  const [description, setDescription] = useState(editingGoal?.description ?? "");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!title.trim()) { Alert.alert("Ошибка", "Введите название цели"); return; }
    const target = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;
    if (isNaN(target) || target <= 0) { Alert.alert("Ошибка", "Введите корректную целевую сумму"); return; }

    setSaving(true);
    try {
      if (editingGoal) {
        await api.updateGoal(editingGoal.id, { title: title.trim(), targetAmount: target, currentAmount: current, description: description.trim() });
      } else {
        await api.createGoal({ title: title.trim(), targetAmount: target, currentAmount: current, description: description.trim() });
      }
      navigation.goBack();
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить цель"); }
    finally { setSaving(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    content: { padding: 16, paddingBottom: 32 },
    label: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 8, marginTop: 8 },
    input: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8, color: theme.textPrimary },
    textArea: { minHeight: 80, textAlignVertical: "top", marginBottom: 24 },
    saveBtn: { backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingVertical: 14, minHeight: theme.btnHeight, justifyContent: "center", alignItems: "center" },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  }), [theme]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      <Text style={styles.label}>Название</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Название цели" placeholderTextColor={theme.textTertiary} />

      <Text style={styles.label}>Целевая сумма (₽)</Text>
      <TextInput style={styles.input} value={targetAmount} onChangeText={setTargetAmount} placeholder="100000" placeholderTextColor={theme.textTertiary} keyboardType="numeric" />

      <Text style={styles.label}>Текущая сумма (₽)</Text>
      <TextInput style={styles.input} value={currentAmount} onChangeText={setCurrentAmount} placeholder="0" placeholderTextColor={theme.textTertiary} keyboardType="numeric" />

      <Text style={styles.label}>Описание</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Описание цели" placeholderTextColor={theme.textTertiary} multiline numberOfLines={3} />

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "Сохранение…" : editingGoal ? "Сохранить" : "Создать"}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
