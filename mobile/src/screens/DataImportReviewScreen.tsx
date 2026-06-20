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
} from "react-native";
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
      kind?: "excel" | "receipt";
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

function formatDate(value?: string) {
  if (!value) return "Не указана";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD.MM.YYYY") : value;
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

export default function DataImportReviewScreen({ route, navigation }: Props) {
  const { api } = useAuth();
  const { theme } = useTheme();
  const [preview, setPreview] = useState<TransactionImportPreview | null>(route.params?.preview ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>(
    route.params?.preview?.drafts.map((draft) => draft.categoryHint ?? draft.suggestedCategoryToCreate ?? "") ?? []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route.params?.preview) {
      setPreview(route.params.preview);
      setCategoryDrafts(
        route.params.preview.drafts.map(
          (draft) => draft.categoryHint ?? draft.suggestedCategoryToCreate ?? ""
        )
      );
    }
  }, [route.params?.preview]);

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

  const updateCategoryDraft = useCallback((index: number, value: string) => {
    setCategoryDrafts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const saveDrafts = useCallback(async () => {
    if (!preview?.drafts.length) {
      Alert.alert("Импорт", "Нет строк для сохранения.");
      return;
    }

    setSaving(true);
    let createdCategories = 0;
    let savedTransactions = 0;
    let skippedTransactions = 0;
    const createdByName = new Map<string, Category>();

    try {
      for (let index = 0; index < preview.drafts.length; index += 1) {
        const draft = preview.drafts[index];
        const desiredName = (
          categoryDrafts[index] ||
          draft.suggestedCategoryToCreate ||
          draft.categoryHint ||
          ""
        ).trim();

        if (!desiredName) {
          continue;
        }

        const resolved = resolveCategoryName(draft, desiredName, categories);
        if (resolved) {
          continue;
        }

        const normalizedName = normalize(desiredName);
        if (createdByName.has(normalizedName)) {
          continue;
        }

        const created = await api.createCategory({
          name: desiredName[0].toUpperCase() + desiredName.slice(1),
          color: theme.accentMuted,
          icon: "pricetag-outline",
          type: draft.type,
        });
        createdByName.set(normalizedName, created);
        createdCategories += 1;
      }

      for (let index = 0; index < preview.drafts.length; index += 1) {
        const draft = preview.drafts[index];
        const desiredName = (
          categoryDrafts[index] ||
          draft.suggestedCategoryToCreate ||
          draft.categoryHint ||
          ""
        ).trim();

        let category = resolveCategoryName(draft, desiredName, categories);
        if (!category && desiredName) {
          category = createdByName.get(normalize(desiredName)) ?? null;
        }

        if (!category) {
          skippedTransactions += 1;
          continue;
        }

        await api.createTransaction({
          type: draft.type,
          amount: draft.amount,
          description: draft.description?.trim() || preview.title,
          date: draft.date || dayjs().format("YYYY-MM-DD"),
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
          ? `Сохранено: ${savedTransactions}. Создано категорий: ${createdCategories}. Пропущено: ${skippedTransactions}.`
          : `Сохранено: ${savedTransactions}. Создано категорий: ${createdCategories}.`
      );
    } catch (error: any) {
      Alert.alert("Импорт", error?.message ?? "Не удалось сохранить импортированные строки.");
    } finally {
      setSaving(false);
    }
  }, [
    api,
    categories,
    categoryDrafts,
    navigation,
    preview,
    theme.accentMuted,
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
              Откройте импорт из Excel или фото чека еще раз.
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
          Проверьте распознанные строки и при необходимости скорректируйте
          категории перед сохранением.
        </Text>
      </View>

      {warnings.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{warnings.join("\n")}</Text>
        </View>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Строк для обработки: {draftCount}. Дата в каждой операции сохраняется
          в том виде, как ее распознал LLM или импорт из файла.
        </Text>
      </View>

      {preview.drafts.map((draft, index) => {
        const resolved = resolveCategoryName(draft, categoryDrafts[index] ?? "", categories);
        return (
          <View key={`${draft.type}-${draft.amount}-${index}`} style={styles.draftCard}>
            <View style={styles.draftHeader}>
              <Text style={styles.draftTitle}>{draft.description?.trim() || `Строка ${index + 1}`}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{draft.type === "income" ? "Доход" : "Расход"}</Text>
              </View>
            </View>

            <Text style={styles.amount}>₽{draft.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</Text>
            <Text style={styles.draftMeta}>Дата: {formatDate(draft.date)}</Text>
            <Text style={styles.draftMeta}>Категория: {resolved?.name ?? "Не определена"}</Text>

            <View>
              <Text style={styles.inputLabel}>Категория</Text>
              <TextInput
                style={styles.input}
                value={categoryDrafts[index] ?? ""}
                onChangeText={(value) => updateCategoryDraft(index, value)}
                placeholder="Введите или исправьте категорию"
                placeholderTextColor={theme.textTertiary}
              />
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
