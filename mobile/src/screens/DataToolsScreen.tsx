import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useTheme } from "../context";
import { API_BASE_URL } from "../constants/config";
import { openReceiptImportFlow } from "../services/dataTools";

type Props = {
  navigation: any;
};

export default function DataToolsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { theme } = useTheme();
  const [busy, setBusy] = useState<"receiptGallery" | "receiptCamera" | null>(null);

  const ensureToken = () => {
    if (!token) {
      Alert.alert("Требуется вход", "Сначала войдите в аккаунт.");
      return null;
    }
    return token;
  };

  const handleReceipt = async (source: "gallery" | "camera") => {
    const authToken = ensureToken();
    if (!authToken) return;
    setBusy(source === "camera" ? "receiptCamera" : "receiptGallery");
    try {
      const preview = await openReceiptImportFlow(API_BASE_URL, authToken, source);
      if (preview) {
        navigation.navigate("DataImportReview", {
          preview,
        });
      } else if (Platform.OS !== "web") {
        Alert.alert(
          "Фото чека",
          source === "camera"
            ? "Сделайте снимок в браузере, после загрузки вы вернетесь в приложение."
            : "Выберите фото в браузере, после загрузки вы вернетесь в приложение."
        );
      }
    } catch (error: any) {
      Alert.alert("Не удалось обработать чек", error?.message ?? "Попробуйте еще раз.");
    } finally {
      setBusy(null);
    }
  };

  const styles = useMemoStyles(theme);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[theme.accentMuted, theme.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="camera-outline" size={26} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>Распознавание чеков</Text>
        <Text style={styles.heroText}>
          Загрузите фото чека, проверьте черновик операции и сохраните его в приложение.
        </Text>
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="camera-outline" size={20} color={theme.accentMuted} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>Фото чека</Text>
            <Text style={styles.cardSubtitle}>
              QR-код и фискальные поля распознаются локально, без LLM.
            </Text>
          </View>
        </View>
        <View style={styles.receiptActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleReceipt("gallery")}
            disabled={busy !== null}
          >
            {busy === "receiptGallery" ? (
              <ActivityIndicator color={theme.accentMuted} />
            ) : (
              <Text style={styles.secondaryButtonText}>Выбрать фото</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleReceipt("camera")}
            disabled={busy !== null}
          >
            {busy === "receiptCamera" ? (
              <ActivityIndicator color={theme.accentMuted} />
            ) : (
              <Text style={styles.secondaryButtonText}>Сделать снимок</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
        <Text style={styles.noteText}>
          На Android загрузка фото открывается через системный браузер, чтобы не требовать отдельного file picker.
        </Text>
      </View>
    </ScrollView>
  );
}

function useMemoStyles(theme: any) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.bgBase,
        },
        content: {
          padding: 16,
          paddingBottom: 32,
          gap: 14,
        },
        hero: {
          borderRadius: theme.radius2xl,
          padding: 18,
          shadowColor: theme.shadowLg,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 16,
          elevation: 4,
        },
        heroIcon: {
          width: 52,
          height: 52,
          borderRadius: theme.radiusLg,
          backgroundColor: "rgba(255,255,255,0.18)",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 14,
        },
        heroTitle: {
          fontSize: 22,
          fontWeight: "700",
          color: "#fff",
          marginBottom: 8,
        },
        heroText: {
          fontSize: 14,
          lineHeight: 20,
          color: "rgba(255,255,255,0.86)",
        },
        card: {
          backgroundColor: theme.bgCard,
          borderRadius: theme.radius2xl,
          padding: 16,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.shadowSm,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
        },
        cardHeader: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
        },
        cardIcon: {
          width: 40,
          height: 40,
          borderRadius: theme.radiusLg,
          backgroundColor: theme.accentMutedLight,
          justifyContent: "center",
          alignItems: "center",
        },
        cardTextWrap: {
          flex: 1,
        },
        cardTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: theme.textPrimary,
          marginBottom: 4,
        },
        cardSubtitle: {
          fontSize: 13,
          lineHeight: 18,
          color: theme.textSecondary,
        },
        secondaryButton: {
          minHeight: theme.btnHeight,
          borderRadius: theme.radiusMd,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.bgSurface,
          justifyContent: "center",
          alignItems: "center",
        },
        receiptActions: {
          gap: 10,
        },
        secondaryButtonText: {
          color: theme.textPrimary,
          fontSize: 15,
          fontWeight: "700",
        },
        noteCard: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          backgroundColor: theme.bgCard,
          borderRadius: theme.radiusLg,
          padding: 14,
          borderWidth: 1,
          borderColor: theme.border,
        },
        noteText: {
          flex: 1,
          fontSize: 12,
          lineHeight: 17,
          color: theme.textSecondary,
        },
      }),
    [theme]
  );
}
