import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context";

interface ErrorViewProps {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export default function ErrorView({
  message = "Не удалось загрузить данные",
  onRetry,
  retrying = false,
  compact = false,
}: ErrorViewProps) {
  const { theme } = useTheme();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: theme.expenseLight, borderColor: theme.expense }]}>
        <Ionicons name="cloud-offline-outline" size={18} color={theme.expense} />
        <Text style={[styles.compactText, { color: theme.expense }]} numberOfLines={1}>
          {message}
        </Text>
        {retrying ? (
          <ActivityIndicator size="small" color={theme.expense} />
        ) : (
          <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.compactRetry, { color: theme.expense }]}>Повторить</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={48} color={theme.textTertiary} />
      <Text style={[styles.title, { color: theme.textPrimary }]}>{message}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Проверьте подключение к интернету{"\n"}и попробуйте снова
      </Text>
      {retrying ? (
        <ActivityIndicator size="large" color={theme.accentMuted} style={styles.loader} />
      ) : (
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: theme.accentMuted }]}
          onPress={onRetry}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  loader: {
    marginTop: 8,
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  compactRetry: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
