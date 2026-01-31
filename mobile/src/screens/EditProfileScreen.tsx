import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth, useTheme } from "../context";

export default function EditProfileScreen({ navigation }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api.getProfile();
        setLastName(profile.lastName ?? "");
        setFirstName(profile.firstName ?? "");
        setMiddleName(profile.middleName ?? "");
        setDateOfBirth(profile.dateOfBirth ? new Date(profile.dateOfBirth) : null);
      } catch {}
    })();
  }, [api]);

  const onSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        lastName: lastName.trim() || undefined,
        firstName: firstName.trim() || undefined,
        middleName: middleName.trim() || undefined,
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : undefined,
      });
      navigation.goBack();
    } catch (e: any) { Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить профиль"); }
    finally { setSaving(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    content: { padding: 16, paddingBottom: 32 },
    label: { fontSize: 14, fontWeight: "600", color: theme.textPrimary, marginBottom: 8, marginTop: 8 },
    input: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 8, color: theme.textPrimary },
    dateBtn: { backgroundColor: theme.bgCard, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 },
    dateBtnText: { fontSize: 16, color: theme.textPrimary },
    saveBtn: { backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingVertical: 14, minHeight: theme.btnHeight, justifyContent: "center", alignItems: "center" },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  }), [theme]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Фамилия</Text>
      <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Фамилия" placeholderTextColor={theme.textTertiary} />

      <Text style={styles.label}>Имя</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Имя" placeholderTextColor={theme.textTertiary} />

      <Text style={styles.label}>Отчество</Text>
      <TextInput style={styles.input} value={middleName} onChangeText={setMiddleName} placeholder="Отчество" placeholderTextColor={theme.textTertiary} />

      <Text style={styles.label}>Дата рождения</Text>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateBtnText}>{dateOfBirth ? dateOfBirth.toLocaleDateString("ru-RU") : "Выбрать дату"}</Text>
      </TouchableOpacity>
      {showDatePicker && <DateTimePicker value={dateOfBirth || new Date()} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_, d) => { setShowDatePicker(false); if (d) setDateOfBirth(d); }} />}

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "Сохранение…" : "Сохранить"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
