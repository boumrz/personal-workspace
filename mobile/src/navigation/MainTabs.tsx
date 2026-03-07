import React, { useEffect, useMemo, useRef, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { navigateToOperations } from "./rootNavigation";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth, useTheme } from "../context";
import { SPEECH_PARSE_PROVIDER } from "../constants/config";
import { emitRefresh } from "../services/dataRefresh";
import OperationsStack from "./OperationsStack";
import DashboardStack from "./DashboardStack";
import SavingsStack from "./SavingsStack";
import ProfileStack from "./ProfileStack";
import { speechRecognitionService } from "../services";
import type { Category, ParsedSpeechTransactionItem } from "@finance-assistant/shared";

const Tab = createBottomTabNavigator();
const TAB_BAR_TOP_PADDING = 10;
const TAB_BAR_MIN_HEIGHT = 56;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<string, { active: IconName; inactive: IconName }> = {
  Operations: { active: "wallet", inactive: "wallet-outline" },
  Dashboard: { active: "bar-chart", inactive: "bar-chart-outline" },
  VoiceAssist: { active: "mic", inactive: "mic" },
  Savings: { active: "cash", inactive: "cash-outline" },
  Profile: { active: "person", inactive: "person-outline" },
};

function VoiceAssistPlaceholder() {
  return <View style={{ flex: 1 }} />;
}

export default function MainTabs() {
  const { api } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 24;
  const tabBarHeight = TAB_BAR_MIN_HEIGHT + TAB_BAR_TOP_PADDING + bottomInset;
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parsedItems, setParsedItems] = useState<ParsedSpeechTransactionItem[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showVoiceUpgradeHint, setShowVoiceUpgradeHint] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const today = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const resetVoiceFlow = () => {
    speechRecognitionService.abort();
    setVoiceModalVisible(false);
    setIsListening(false);
    setIsParsing(false);
    setIsSaving(false);
    setTranscript("");
    setParseWarnings([]);
    setParsedItems([]);
    setCategoryDrafts([]);
  };

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const resolveCategoryByName = (rawName: string) => {
    if (categories.length === 0) {
      return null;
    }
    const hint = normalize(rawName);
    if (hint) {
      const exact = categories.find((c) => normalize(c.name) === hint);
      if (exact) {
        return exact;
      }
      const fuzzy = categories.find((c) => {
        const categoryName = normalize(c.name);
        return categoryName.includes(hint) || hint.includes(categoryName);
      });
      if (fuzzy) {
        return fuzzy;
      }
    }
    return null;
  };

  const resolveCategory = (item: ParsedSpeechTransactionItem, index: number) => {
    const draftName = categoryDrafts[index]?.trim();
    const source = draftName || item.categoryHint || "";
    return resolveCategoryByName(source);
  };

  const updateCategoryDraft = (index: number, value: string) => {
    setCategoryDrafts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const runParse = async (text: string) => {
    const normalized = text.trim();
    if (!normalized) {
      Alert.alert("Голосовой помощник", "Сначала продиктуйте операцию.");
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await api.parseTransactionsFromSpeech({
        text: normalized,
        mode: "actual",
        context: {
          locale: "ru-RU",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        ...(SPEECH_PARSE_PROVIDER
          ? {
              provider: SPEECH_PARSE_PROVIDER as
                | "gigachat"
                | "gemini"
                | "groq"
                | "openrouter"
                | "heuristic",
            }
          : {}),
      });
      setParsedItems(parsed.items);
      setCategoryDrafts(parsed.items.map((item) => item.categoryHint ?? ""));
      setParseWarnings(parsed.warnings ?? []);
      if (!parsed.items.length) {
        Alert.alert("Голосовой помощник", "Не удалось разобрать операции. Попробуйте переформулировать фразу.");
      }
    } catch (error: any) {
      Alert.alert("Ошибка", error?.message ?? "Не удалось обработать голосовой ввод.");
    } finally {
      setIsParsing(false);
    }
  };

  const startListening = async () => {
    if (!speechRecognitionService.isRecognitionAvailable()) {
      Alert.alert("Голосовой помощник", "Распознавание речи недоступно на этом устройстве.");
      return;
    }

    try {
      const [permissionState, userCategories, profile] = await Promise.all([
        speechRecognitionService.ensureMicrophonePermission(),
        api.getCategories(),
        api.getProfile().catch(() => null),
      ]);
      const hasCustomVoiceLlm =
        (profile?.voiceLlmProvider && profile.voiceLlmProvider.trim()) ||
        (Array.isArray(profile?.voiceLlmProviderChain) && profile.voiceLlmProviderChain.length > 0);
      setShowVoiceUpgradeHint(!hasCustomVoiceLlm);
      if (!permissionState.granted) {
        if (!permissionState.canAskAgain) {
          Alert.alert(
            "Доступ к микрофону",
            "Доступ к микрофону отключен для приложения. Откройте настройки и разрешите микрофон вручную.",
            [
              { text: "Отмена", style: "cancel" },
              {
                text: "Открыть настройки",
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ]
          );
        } else {
          Alert.alert("Доступ к микрофону", "Разрешите доступ к микрофону, чтобы использовать голосовой ввод.");
        }
        return;
      }

      setCategories(userCategories);
      setVoiceModalVisible(true);
      setTranscript("");
      setParsedItems([]);
      setParseWarnings([]);
      setIsListening(true);

      speechRecognitionService.start({
        onPartial: (text) => setTranscript(text),
        onFinal: (text) => {
          setTranscript(text);
          setIsListening(false);
          void runParse(text);
        },
        onStatusChange: (status) => {
          if (status === "idle" || status === "stopping") {
            setIsListening(false);
          }
          if (status === "listening") {
            setIsListening(true);
          }
        },
        onError: (message) => {
          setIsListening(false);
          Alert.alert("Голосовой помощник", message);
        },
      });
    } catch (error: any) {
      Alert.alert("Ошибка", error?.message ?? "Не удалось запустить голосовой ввод.");
    }
  };

  const stopListening = () => {
    speechRecognitionService.stop();
    setIsListening(false);
  };

  const saveParsedItems = async () => {
    if (!parsedItems.length) {
      Alert.alert("Голосовой помощник", "Нет операций для добавления.");
      return;
    }

    setIsSaving(true);
    let added = 0;
    let skipped = 0;
    let createdCount = 0;
    try {
      const createdByName = new Map<string, Category>();

      for (let index = 0; index < parsedItems.length; index += 1) {
        const item = parsedItems[index];
        const existing = resolveCategory(item, index);
        if (existing) {
          continue;
        }

        const desiredName = (categoryDrafts[index] || item.categoryHint || "").trim();
        if (!desiredName) {
          skipped += 1;
          continue;
        }

        const normalized = normalize(desiredName);
        if (createdByName.has(normalized)) {
          continue;
        }

        const created = await api.createCategory({
          name: desiredName[0].toUpperCase() + desiredName.slice(1),
          color: theme.accentMuted,
          icon: "pricetag-outline",
        });
        createdByName.set(normalized, created);
        createdCount += 1;
      }

      if (createdByName.size > 0) {
        setCategories((prev) => {
          const existingNames = new Set(prev.map((c) => normalize(c.name)));
          const additions = Array.from(createdByName.values()).filter((c) => !existingNames.has(normalize(c.name)));
          return [...prev, ...additions];
        });
      }

      for (let index = 0; index < parsedItems.length; index += 1) {
        const item = parsedItems[index];
        let category = resolveCategory(item, index);

        if (!category) {
          const desiredName = (categoryDrafts[index] || item.categoryHint || "").trim();
          const fromCreated = desiredName ? createdByName.get(normalize(desiredName)) : undefined;
          category = fromCreated ?? null;
        }

        if (!category) {
          skipped += 1;
          continue;
        }

        await api.createTransaction({
          type: item.type,
          amount: item.amount,
          description: item.description || "Голосовая операция",
          date: item.date || today,
          category,
        });
        added += 1;
      }

      emitRefresh("transactions");
      resetVoiceFlow();
      navigateToOperations();
      Alert.alert(
        "Готово",
        skipped > 0
          ? `Добавлено операций: ${added}. Создано категорий: ${createdCount}. Пропущено: ${skipped}.`
          : `Добавлено операций: ${added}. Создано категорий: ${createdCount}.`
      );
    } catch (error: any) {
      Alert.alert("Ошибка", error?.message ?? "Не удалось сохранить часть операций.");
    } finally {
      setIsSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        voiceTabButton: {
          flex: 1,
          marginTop: -22,
          alignItems: "center",
          justifyContent: "center",
        },
        voicePulse: {
          position: "absolute",
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "rgba(255, 104, 55, 0.24)",
        },
        voiceButton: {
          width: 64,
          height: 64,
          borderRadius: 32,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#ff6d3a",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 16,
          elevation: 10,
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.32)",
        },
        voiceButtonCore: {
          width: 52,
          height: 52,
          borderRadius: 26,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.12)",
        },
        voiceButtonGloss: {
          position: "absolute",
          top: 10,
          left: 14,
          width: 20,
          height: 12,
          borderRadius: 10,
          backgroundColor: "rgba(255, 255, 255, 0.26)",
        },
        hiddenLabel: {
          height: 0,
          fontSize: 0,
        },
        voiceModalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.45)",
          justifyContent: "flex-end",
        },
        voiceModalDimmer: {
          flex: 1,
        },
        voiceModalCard: {
          backgroundColor: theme.bgCard,
          borderTopLeftRadius: theme.radius2xl,
          borderTopRightRadius: theme.radius2xl,
          height: "78%",
          overflow: "hidden",
        },
        voiceModalScroll: {
          flex: 1,
        },
        voiceModalScrollContent: {
          padding: 16,
          paddingBottom: 12,
        },
        title: {
          fontSize: 18,
          fontWeight: "700",
          color: theme.textPrimary,
          marginBottom: 8,
        },
        voiceAssistantDescription: {
          color: theme.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 12,
        },
        voiceUpgradeHint: {
          backgroundColor: theme.warningLight,
          borderRadius: theme.radiusMd,
          padding: 12,
          marginBottom: 12,
        },
        voiceUpgradeHintText: {
          color: theme.textPrimary,
          fontSize: 13,
          lineHeight: 18,
        },
        subtitle: {
          color: theme.textSecondary,
          fontSize: 14,
          marginBottom: 12,
        },
        transcriptBox: {
          minHeight: 96,
          borderRadius: theme.radiusLg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.bgBase,
          padding: 12,
          marginBottom: 12,
        },
        transcriptText: {
          color: theme.textPrimary,
          fontSize: 15,
          lineHeight: 21,
        },
        transcriptPlaceholder: {
          color: theme.textTertiary,
          fontSize: 15,
        },
        warningText: {
          color: theme.warning,
          fontSize: 13,
          marginBottom: 8,
        },
        parsedList: {
          marginBottom: 12,
        },
        parsedItem: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusMd,
          padding: 10,
          marginBottom: 8,
          backgroundColor: theme.bgBase,
        },
        parsedItemTitle: {
          color: theme.textPrimary,
          fontSize: 14,
          fontWeight: "600",
          marginBottom: 4,
        },
        parsedItemMeta: {
          color: theme.textSecondary,
          fontSize: 13,
        },
        categoryInput: {
          marginTop: 8,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusSm,
          backgroundColor: theme.bgCard,
          color: theme.textPrimary,
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 14,
        },
        actionsRow: {
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 20 + bottomInset,
          paddingTop: 12,
          backgroundColor: theme.bgCard,
        },
        button: {
          flex: 1,
          minHeight: theme.btnHeight,
          borderRadius: theme.radiusMd,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
        },
        buttonPrimary: {
          backgroundColor: theme.accentMuted,
          borderColor: theme.accentMuted,
        },
        buttonSecondary: {
          backgroundColor: theme.bgCard,
          borderColor: theme.border,
        },
        buttonDanger: {
          backgroundColor: theme.expenseLight,
          borderColor: theme.expense,
        },
        buttonTextPrimary: {
          color: "#fff",
          fontSize: 14,
          fontWeight: "600",
        },
        buttonTextSecondary: {
          color: theme.textPrimary,
          fontSize: 14,
          fontWeight: "600",
        },
        buttonTextDanger: {
          color: theme.expense,
          fontSize: 14,
          fontWeight: "600",
        },
      }),
    [theme, tabBarHeight, bottomInset]
  );

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: theme.bgBase },
          tabBarStyle: {
            backgroundColor: theme.bgCard,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingTop: TAB_BAR_TOP_PADDING,
            paddingBottom: bottomInset,
            height: tabBarHeight,
            overflow: "visible",
          },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarLabelStyle: { fontSize: 12, fontWeight: "500" as const },
          tabBarIcon: ({ focused, color }) => {
            if (route.name === "VoiceAssist") {
              return null;
            }
            const icons = tabIcons[route.name];
            const iconName = focused ? icons.active : icons.inactive;
            return <Ionicons name={iconName} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Operations"
          component={OperationsStack}
          options={{ title: "Операции", tabBarLabel: "Операции" }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardStack}
          options={{ title: "Дашборд", tabBarLabel: "Дашборд" }}
        />
        <Tab.Screen
          name="VoiceAssist"
          component={VoiceAssistPlaceholder}
          options={{
            title: "Голос",
            tabBarLabel: "",
            tabBarLabelStyle: styles.hiddenLabel,
            tabBarButton: (props) => (
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={props.onPress}
                accessibilityRole={props.accessibilityRole}
                accessibilityState={props.accessibilityState}
                style={styles.voiceTabButton}
              >
                <Animated.View style={[styles.voicePulse, { transform: [{ scale: pulse }] }]} />
                <LinearGradient
                  colors={["#ff9347", "#ff6038", "#ff3d2e"]}
                  start={{ x: 0.1, y: 0.05 }}
                  end={{ x: 0.9, y: 0.95 }}
                  style={styles.voiceButton}
                >
                  <View style={styles.voiceButtonGloss} />
                  <View style={styles.voiceButtonCore}>
                    <Ionicons name="mic" size={26} color="#fff" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              void startListening();
            },
          }}
        />
        <Tab.Screen
          name="Savings"
          component={SavingsStack}
          options={{ title: "Накопления", tabBarLabel: "Накопления" }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{ title: "Профиль", tabBarLabel: "Профиль" }}
        />
      </Tab.Navigator>

      <Modal
        visible={voiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={resetVoiceFlow}
      >
        <View style={styles.voiceModalBackdrop}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.voiceModalDimmer}
            onPress={resetVoiceFlow}
          />
          <View style={styles.voiceModalCard}>
            <ScrollView
              style={styles.voiceModalScroll}
              contentContainerStyle={styles.voiceModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.title}>Голосовой помощник</Text>
              <Text style={styles.voiceAssistantDescription}>
                Добавляйте доходы и расходы голосом. Продиктуйте сумму и описание — например: «Потратил 500 рублей на кофе» или «Получил 3000 зарплата». Помощник распознает операции и добавит их в учёт.
              </Text>
              {showVoiceUpgradeHint && (
                <View style={styles.voiceUpgradeHint}>
                  <Text style={styles.voiceUpgradeHintText}>
                    Обратитесь к разработчику для получения полной версии голосового помощника.
                  </Text>
                </View>
              )}
              <Text style={styles.subtitle}>
                {isListening
                  ? "Скажите операции вслух. Можно перечислять несколько транзакций подряд."
                  : "Проверьте распознанный текст и подтвердите добавление."}
              </Text>

              <View style={styles.transcriptBox}>
                {transcript ? (
                  <Text style={styles.transcriptText}>{transcript}</Text>
                ) : (
                  <Text style={styles.transcriptPlaceholder}>Нажмите на микрофон и продиктуйте операцию.</Text>
                )}
              </View>

              {isParsing && <ActivityIndicator size="small" color={theme.accentMuted} style={{ marginBottom: 12 }} />}

              {parseWarnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>
                  {warning}
                </Text>
              ))}

              {parsedItems.length > 0 && (
                <View style={styles.parsedList}>
                  {parsedItems.map((item, index) => {
                    const category = resolveCategory(item, index);
                    const suggestion =
                      categoryDrafts[index] ||
                      item.suggestedCategoryToCreate ||
                      item.categoryHint ||
                      "";
                    return (
                      <View key={`${item.type}-${item.amount}-${index}`} style={styles.parsedItem}>
                        <Text style={styles.parsedItemTitle}>
                          {item.type === "income" ? "Доход" : "Расход"} · ₽{item.amount.toLocaleString("ru-RU")}
                        </Text>
                        <Text style={styles.parsedItemMeta}>
                          {item.description || "Без описания"}
                        </Text>
                        <Text style={styles.parsedItemMeta}>
                          Категория: {category?.name ?? "Не определена"}
                        </Text>
                        {!category && (
                          <>
                            <Text style={styles.parsedItemMeta}>
                              {item.categoryResolution === "suggest_create"
                                ? `Предложение: создать категорию «${suggestion || "Новая категория"}»`
                                : `Предположение алгоритма: ${suggestion || "не удалось определить"}`}
                            </Text>
                            <TextInput
                              style={styles.categoryInput}
                              value={categoryDrafts[index] ?? ""}
                              onChangeText={(value) => updateCategoryDraft(index, value)}
                              placeholder="Введите категорию (создадим автоматически)"
                              placeholderTextColor={theme.textTertiary}
                            />
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={resetVoiceFlow} disabled={isSaving}>
                <Text style={styles.buttonTextSecondary}>Закрыть</Text>
              </TouchableOpacity>

              {isListening ? (
                <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={stopListening}>
                  <Text style={styles.buttonTextDanger}>Стоп</Text>
                </TouchableOpacity>
              ) : parsedItems.length > 0 ? (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() => void saveParsedItems()}
                  disabled={isSaving}
                >
                  <Text style={styles.buttonTextPrimary}>{isSaving ? "Сохраняем..." : "Добавить"}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() => {
                    if (transcript.trim()) {
                      void runParse(transcript);
                    } else {
                      void startListening();
                    }
                  }}
                  disabled={isParsing || isSaving}
                >
                  <Text style={styles.buttonTextPrimary}>{isParsing ? "Обработка..." : "Обработать"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
