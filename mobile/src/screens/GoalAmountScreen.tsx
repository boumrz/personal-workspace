import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth, useTheme } from "../context";

export default function GoalAmountScreen({ navigation, route }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const { goal, type } = route.params;
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert("Ошибка", "Введите корректную сумму");
      return;
    }

    const delta = type === "add" ? value : -value;
    const newAmount = Math.max(0, goal.currentAmount + delta);

    setSaving(true);
    try {
      await api.updateGoal(goal.id, { currentAmount: newAmount });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось обновить цель");
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.bgBase },
        content: { padding: 16, paddingTop: 24 },
        label: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.textPrimary,
          marginBottom: 8,
        },
        input: {
          backgroundColor: theme.bgCard,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusMd,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          marginBottom: 12,
          color: theme.textPrimary,
        },
        hint: { fontSize: 14, color: theme.textSecondary, marginBottom: 24 },
        saveBtn: {
          backgroundColor: theme.accentMuted,
          borderRadius: theme.radiusMd,
          paddingVertical: 14,
          minHeight: theme.btnHeight,
          justifyContent: "center",
          alignItems: "center",
        },
        saveBtnDisabled: { opacity: 0.7 },
        saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
      }),
    [theme]
  );

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
        <Text style={styles.label}>Сумма (₽)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="Введите сумму"
          placeholderTextColor={theme.textTertiary}
          keyboardType="numeric"
          autoFocus
        />
        <Text style={styles.hint}>Текущая сумма: {goal.currentAmount.toLocaleString("ru-RU")} ₽</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSubmit}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "Сохранение…" : "Применить"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
