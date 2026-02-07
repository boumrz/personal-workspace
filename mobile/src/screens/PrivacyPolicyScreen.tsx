import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context";
import { PRIVACY_POLICY_SECTIONS } from "../constants/legal";

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.bgBase },
        content: { padding: 16, paddingBottom: Math.max(32, insets.bottom + 16) },
        section: { marginBottom: 20 },
        sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.textPrimary, marginBottom: 8 },
        sectionText: { fontSize: 14, lineHeight: 22, color: theme.textSecondary },
        header: { fontSize: 12, color: theme.textTertiary, marginBottom: 16 },
      }),
    [theme, insets.bottom]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Дата вступления в силу: 2026 год.</Text>
      {PRIVACY_POLICY_SECTIONS.map((s, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.sectionTitle}>{s.title}</Text>
          <Text style={styles.sectionText}>{s.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
