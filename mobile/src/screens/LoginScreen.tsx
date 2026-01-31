import React, { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { useAuth, useTheme } from "../context";

type Tab = "login" | "register";

export default function LoginScreen() {
  const { login, register } = useAuth();
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const onLogin = async () => {
    if (!loginValue.trim() || !password.trim()) { Alert.alert("Ошибка", "Введите логин и пароль"); return; }
    try { setLoading(true); await login(loginValue.trim(), password); }
    catch (e: any) { Alert.alert("Ошибка входа", e?.message ?? "Неверный логин или пароль"); }
    finally { setLoading(false); }
  };

  const onRegister = async () => {
    if (!fullName.trim() || !loginValue.trim() || !password.trim()) { Alert.alert("Ошибка", "Заполните все поля"); return; }
    if (loginValue.length < 3) { Alert.alert("Ошибка", "Логин должен быть не менее 3 символов"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(loginValue)) { Alert.alert("Ошибка", "Логин может содержать только буквы, цифры и _"); return; }
    if (password.length < 6) { Alert.alert("Ошибка", "Пароль должен быть не менее 6 символов"); return; }
    try { setLoading(true); await register(fullName.trim(), loginValue.trim(), password); }
    catch (e: any) { Alert.alert("Ошибка регистрации", e?.message ?? "Не удалось зарегистрироваться"); }
    finally { setLoading(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgBase },
    scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60 },
    title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 24, color: theme.textPrimary },
    tabs: { flexDirection: "row", marginBottom: 20, backgroundColor: theme.bgSurface, borderRadius: theme.radiusXl, padding: 4 },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: theme.radiusLg },
    tabActive: { backgroundColor: theme.bgCard, shadowColor: theme.shadowMd, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
    tabText: { fontSize: 16, fontWeight: "500", color: theme.textSecondary },
    tabTextActive: { color: theme.textPrimary, fontWeight: "600" },
    form: { backgroundColor: theme.bgCard, borderRadius: theme.radius2xl, padding: 20, shadowColor: theme.shadowSm, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 40, elevation: 3 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 14, backgroundColor: theme.bgElevated, color: theme.textPrimary },
    button: { backgroundColor: theme.accentMuted, borderRadius: theme.radiusMd, paddingVertical: 14, minHeight: theme.btnHeight, justifyContent: "center", alignItems: "center", marginTop: 6 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  }), [theme]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Финансовый помощник</Text>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === "login" && styles.tabActive]} onPress={() => setTab("login")}>
            <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>Вход</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === "register" && styles.tabActive]} onPress={() => setTab("register")}>
            <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>Регистрация</Text>
          </TouchableOpacity>
        </View>

        {tab === "login" ? (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Логин" placeholderTextColor={theme.textTertiary} value={loginValue} onChangeText={setLoginValue} autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} placeholder="Пароль" placeholderTextColor={theme.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Войти</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="ФИО" placeholderTextColor={theme.textTertiary} value={fullName} onChangeText={setFullName} />
            <TextInput style={styles.input} placeholder="Логин (не менее 3 символов)" placeholderTextColor={theme.textTertiary} value={loginValue} onChangeText={setLoginValue} autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} placeholder="Пароль (не менее 6 символов)" placeholderTextColor={theme.textTertiary} value={password} onChangeText={setPassword} secureTextEntry />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Зарегистрироваться</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
