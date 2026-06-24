import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useTheme } from "../context";
import { emitRefresh } from "../services/dataRefresh";
import { navigateToOperations } from "../navigation/rootNavigation";
import type {
  Category,
  TransactionDraft,
  TransactionImportPreview,
} from "@finance-assistant/shared";

type Props = {
  route: {
    params?: {
      preview?: TransactionImportPreview;
    };
  };
  navigation: any;
};

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/С‘/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDate(value?: string) {
  const parsed = value ? dayjs(value) : null;
  if (parsed && parsed.isValid()) {
    return parsed.format("YYYY-MM-DD");
  }
  return dayjs().format("YYYY-MM-DD");
}

function categoryMatchesTransactionType(category: Category, transactionType: "income" | "expense") {
  const scope =
    category.type ||
    (category.name === "Зарплата"
      ? "income"
      : category.name === "Другое"
        ? "both"
        : "expense");
  return scope === "both" || scope === transactionType;
}

function parseDraftAmount(value: string) {
  const normalized = String(value || "").replace(/\s+/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function getAvailableCategories(categories: Category[], transactionType: "income" | "expense") {
  return categories
    .filter((category) => categoryMatchesTransactionType(category, transactionType))
    .sort((a, b) => {
      if (a.name === "Другое") return 1;
      if (b.name === "Другое") return -1;
      return a.name.localeCompare(b.name, "ru");
    });
}

function resolveCategoryName(
  draft: TransactionDraft,
  draftValue: string,
  categories: Category[]
) {
  const raw = draftValue.trim() || draft.suggestedCategoryToCreate || draft.categoryHint || "";
  if (!raw) return null;
  const hint = normalize(raw);
  if (!hint) return null;

  const exact = categories.find(
    (category) => normalize(category.name) === hint && categoryMatchesTransactionType(category, draft.type)
  );
  if (exact) return exact;

  const fuzzy = categories.find((category) => {
    const categoryName = normalize(category.name);
    return categoryMatchesTransactionType(category, draft.type) && (categoryName.includes(hint) || hint.includes(categoryName));
  });
  return fuzzy ?? null;
}

function resolveInitialCategoryName(draft: TransactionDraft, categories: Category[]) {
  const hint = draft.categoryHint ?? draft.suggestedCategoryToCreate ?? "";
  if (hint) {
    const match = resolveCategoryName(draft, hint, categories);
    if (match) return match.name;
  }

  const other = categories.find((category) => category.name === "Другое");
  if (other && categoryMatchesTransactionType(other, draft.type)) {
    return other.name;
  }

  return getAvailableCategories(categories, draft.type)[0]?.name ?? "";
}

function buildDraftEdits(drafts: TransactionDraft[], categories: Category[]) {
  return drafts.map((draft) => ({
    amount: String(draft.amount),
    description: draft.description?.trim() || "",
    date: safeDate(draft.date),
    category: resolveInitialCategoryName(draft, categories),
  }));
}

export default function DataImportReviewScreen({ route, navigation }: Props) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [preview, setPreview] = useState<TransactionImportPreview | null>(route.params?.preview ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draftEdits, setDraftEdits] = useState<Array<{ amount: string; description: string; date: string; category: string }>>([]);
  const [datePickerIndex, setDatePickerIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route.params?.preview) {
      setPreview(route.params.preview);
    }
  }, [route.params?.preview]);

  useEffect(() => {
    if (!preview?.drafts.length || categories.length === 0) {
      return;
    }
    setDraftEdits(buildDraftEdits(preview.drafts, categories));
  }, [preview, categories]);

  useEffect(() => {
    let mounted = true;
    api
      .getCategories()
      .then((items) => {
        if (mounted) {
          setCategories(items);
        }
      })
      .catch(() => {
        if (mounted) {
          setCategories([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [api]);

  const draftCount = preview?.drafts.length ?? 0;
  const warnings = preview?.warnings ?? [];

  const updateDraftEdit = useCallback(
    (index: number, patch: Partial<{ amount: string; description: string; date: string; category: string }>) => {
      setDraftEdits((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    []
  );

  const saveDrafts = useCallback(async () => {
    if (!preview?.drafts.length) {
      Alert.alert("Импорт", "Нет строк для сохранения.");
      return;
    }

    setSaving(true);
    let savedTransactions = 0;
    let skippedTransactions = 0;

    try {
      for (let index = 0; index < preview.drafts.length; index += 1) {
        const draft = preview.drafts[index];
        const edit = draftEdits[index];
        const amount = parseDraftAmount(edit?.amount ?? String(draft.amount));
        const description = edit?.description?.trim() || draft.description?.trim() || preview.title;
        const date = safeDate(edit?.date || draft.date);
        const desiredName = edit?.category?.trim() ?? "";

        if (!amount || !desiredName) {
          skippedTransactions += 1;
          continue;
        }

        const category = resolveCategoryName(draft, desiredName, categories);
        if (!category) {
          skippedTransactions += 1;
          continue;
        }

        await api.createTransaction({
          type: draft.type,
          amount,
          description,
          date,
          category,
        });
        savedTransactions += 1;
      }

      emitRefresh("transactions");
      navigation.goBack();
      navigateToOperations();
      Alert.alert(
        "Импорт завершен",
        skippedTransactions > 0
          ? `Сохранено: ${savedTransactions}. Пропущено: ${skippedTransactions}.`
          : `Сохранено: ${savedTransactions}.`
      );
    } catch (error: any) {
      Alert.alert("Импорт", error?.message ?? "Не удалось сохранить импортированные строки.");
    } finally {
      setSaving(false);
    }
  }, [
    api,
    categories,
    draftEdits,
    navigation,
    preview,
  ]);

  const styles = useMemo(
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
          backgroundColor: theme.bgCard,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
          shadowColor: theme.shadowSm,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
        },
        heroTop: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        },
        heroIcon: {
          width: 48,
          height: 48,
          borderRadius: theme.radiusLg,
          backgroundColor: theme.accentMutedLight,
          justifyContent: "center",
          alignItems: "center",
        },
        heroTitle: {
          flex: 1,
          fontSize: 20,
          fontWeight: "700",
          color: theme.textPrimary,
        },
        heroText: {
          fontSize: 13,
          lineHeight: 18,
          color: theme.textSecondary,
        },
        warningBox: {
          backgroundColor: theme.warningLight,
          borderRadius: theme.radiusLg,
          padding: 12,
          borderWidth: 1,
          borderColor: "rgba(255, 149, 0, 0.2)",
        },
        warningText: {
          fontSize: 12,
          lineHeight: 17,
          color: theme.textPrimary,
        },
        draftCard: {
          backgroundColor: theme.bgCard,
          borderRadius: theme.radius2xl,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 14,
          gap: 10,
        },
        draftHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        },
        draftTitle: {
          fontSize: 15,
          fontWeight: "700",
          color: theme.textPrimary,
        },
        typeBadge: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: theme.accentMutedLight,
        },
        typeBadgeText: {
          color: theme.accentMuted,
          fontSize: 12,
          fontWeight: "700",
          textTransform: "uppercase",
        },
        draftMeta: {
          fontSize: 13,
          color: theme.textSecondary,
        },
        amount: {
          fontSize: 18,
          fontWeight: "800",
          color: theme.textPrimary,
        },
        inputLabel: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          marginBottom: 6,
        },
        dateButton: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusMd,
          backgroundColor: theme.bgSurface,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        dateButtonText: {
          fontSize: 15,
          color: theme.textPrimary,
        },
        categoryChips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        categoryChip: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: theme.bgSurface,
        },
        categoryChipActive: {
          borderColor: theme.accentMuted,
        },
        categoryChipText: {
          fontSize: 13,
          color: theme.textPrimary,
        },
        categoryChipTextActive: {
          color: "#fff",
          fontWeight: "700",
        },
        input: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusMd,
          backgroundColor: theme.bgSurface,
          color: theme.textPrimary,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
        },
        footer: {
          flexDirection: "row",
          gap: 10,
          marginTop: 4,
        },
        secondaryButton: {
          flex: 1,
          minHeight: theme.btnHeight,
          borderRadius: theme.radiusMd,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.bgCard,
          justifyContent: "center",
          alignItems: "center",
        },
        secondaryButtonText: {
          fontSize: 15,
          fontWeight: "700",
          color: theme.textPrimary,
        },
        primaryButton: {
          flex: 1,
          minHeight: theme.btnHeight,
          borderRadius: theme.radiusMd,
          backgroundColor: theme.accentMuted,
          justifyContent: "center",
          alignItems: "center",
        },
        primaryButtonText: {
          fontSize: 15,
          fontWeight: "700",
          color: "#fff",
        },
        summary: {
          backgroundColor: theme.bgCard,
          borderRadius: theme.radiusLg,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
        },
        summaryText: {
          fontSize: 13,
          color: theme.textSecondary,
          lineHeight: 18,
        },
      }),
    [theme]
  );

  if (!preview) {
    return (
      <View style={styles.container}>
        <View style={[styles.content, { justifyContent: "center", flex: 1 }]}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Импорт не найден</Text>
            <Text style={styles.heroText}>
              Откройте распознавание чека еще раз.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="checkmark-done-outline" size={24} color={theme.accentMuted} />
          </View>
          <Text style={styles.heroTitle}>{preview.title}</Text>
        </View>
        <Text style={styles.heroText}>
          Проверьте распознанные операции и при необходимости исправьте сумму,
          описание, дату и категорию перед сохранением.
        </Text>
      </View>

      {warnings.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{warnings.join("\n")}</Text>
        </View>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Операций для сохранения: {draftCount}.
        </Text>
      </View>

      {preview.drafts.map((draft, index) => {
        const edit = draftEdits[index];
        const categoryName = edit?.category?.trim() || "";
        const resolved = categoryName ? resolveCategoryName(draft, categoryName, categories) : null;
        const draftDate = safeDate(edit?.date || draft.date);
        const availableCategories = getAvailableCategories(categories, draft.type);
        return (
          <View key={`${draft.type}-${draft.amount}-${index}`} style={styles.draftCard}>
            <View style={styles.draftHeader}>
              <Text style={styles.draftTitle}>Операция {index + 1}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{draft.type === "income" ? "Доход" : "Расход"}</Text>
              </View>
            </View>

            {resolved ? <Text style={styles.draftMeta}>Категория: {resolved.name}</Text> : null}

            <View>
              <Text style={styles.inputLabel}>Описание</Text>
              <TextInput
                style={styles.input}
                value={edit?.description ?? ""}
                onChangeText={(value) => updateDraftEdit(index, { description: value })}
                placeholder="Описание операции"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Сумма</Text>
              <TextInput
                style={styles.input}
                value={edit?.amount ?? ""}
                onChangeText={(value) => updateDraftEdit(index, { amount: value })}
                placeholder="0,00"
                placeholderTextColor={theme.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Дата</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setDatePickerIndex(index)}
              >
                <Text style={styles.dateButtonText}>
                  {dayjs(draftDate).format("DD.MM.YYYY")}
                </Text>
              </TouchableOpacity>
              {datePickerIndex === index && (
                <DateTimePicker
                  value={dayjs(draftDate).toDate()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selectedDate) => {
                    if (Platform.OS !== "ios") {
                      setDatePickerIndex(null);
                    }
                    if (selectedDate) {
                      updateDraftEdit(index, { date: dayjs(selectedDate).format("YYYY-MM-DD") });
                    }
                  }}
                />
              )}
            </View>

            <View>
              <Text style={styles.inputLabel}>Категория</Text>
              <View style={styles.categoryChips}>
                {availableCategories.map((category) => {
                  const isActive = edit?.category === category.name;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        isActive && styles.categoryChipActive,
                        isActive && { backgroundColor: category.color, borderColor: category.color },
                      ]}
                      onPress={() => updateDraftEdit(index, { category: category.name })}
                    >
                      <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void saveDrafts()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
