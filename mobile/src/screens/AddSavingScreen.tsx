import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth, useTheme } from "../context";

function formatDateForInput(d: Date) { return d.toISOString().slice(0, 10); }

export default function AddSavingScreen({ navigation }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) { Alert.alert("Ошибка", "Введите сумму"); return; }
    setSaving(true);
    try {
      await api.createSaving({ amount: num, description: description.trim() || "", date: formatDateForInput(date) });
      navigation.goBack();
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось добавить накопление"); }
    finally { setSaving(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    content: { padding: 16, paddingBottom: 32 },
    label: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 8 },
    input: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16, color: theme.textPrimary },
    dateBtn: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 },
    dateBtnText: { fontSize: 16, color: theme.textPrimary },
    saveBtn: { backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingVertical: 14, minHeight: theme.btnHeight, justifyContent: "center", alignItems: "center" },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  }), [theme]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Сумма (₽)</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={theme.textTertiary} keyboardType="decimal-pad" />

      <Text style={styles.label}>Описание (необязательно)</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Например: резерв" placeholderTextColor={theme.textTertiary} />

      <Text style={styles.label}>Дата</Text>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateBtnText}>{formatDateForInput(date)}</Text>
      </TouchableOpacity>
      {showDatePicker && <DateTimePicker value={date} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }} />}

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "Сохранение…" : "Сохранить"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
