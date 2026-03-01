import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import utc from "dayjs/plugin/utc";
import { useAuth, useTheme } from "../context";
import { ConfirmModal } from "../components";
import { getIoniconsName } from "../utils/iconMap";
import { consumeLastCreatedCategoryId } from "./AddCategoryScreen";
import type { Category, Transaction } from "@finance-assistant/shared";

// Базовые категории без кнопки удаления (как на веб)
const DEFAULT_NAMES = ["Продукты", "Транспорт", "Развлечения", "Здоровье", "Одежда", "Жилье", "Зарплата", "Другое"];

dayjs.extend(utc);
dayjs.locale("ru");

function formatDateForInput(d: dayjs.Dayjs) {
  // Используем format для корректного формата даты
  return d.format("YYYY-MM-DD");
}

function formatMonthDisplay(year: number, month: number) {
  // month приходит как 1-12, Date использует 0-11
  const date = new Date(year, month - 1, 15);
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export default function AddTransactionScreen({ navigation, route }: any) {
  const { api } = useAuth();
  const { theme } = useTheme();
  
  const mode = route?.params?.mode ?? "actual";
  const isPlanned = mode === "planned";
  const editingTransaction: Transaction | null = route?.params?.transaction ?? null;
  const isEditing = !!editingTransaction;
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<Transaction[]>([]);
  const [type, setType] = useState<"income" | "expense">(editingTransaction?.type ?? "expense");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(editingTransaction?.category ?? null);
  const [amount, setAmount] = useState(editingTransaction ? String(editingTransaction.amount) : "");
  const [description, setDescription] = useState(editingTransaction?.description ?? "");
  const [date, setDate] = useState(editingTransaction ? dayjs(editingTransaction.date) : dayjs());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; category: Category | null }>({ visible: false, category: null });
  const [deleteOperationModalVisible, setDeleteOperationModalVisible] = useState(false);
  
  // Генерация списка месяцев для выбора (текущий + 11 будущих)
  // month хранится как 1-12 (не 0-11)
  const availableMonths = useMemo(() => {
    const months: { year: number; month: number; label: string }[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    for (let i = 0; i < 12; i++) {
      const totalMonths = currentMonth + i;
      const year = currentYear + Math.floor((totalMonths - 1) / 12);
      const month = ((totalMonths - 1) % 12) + 1; // 1-12
      // Форматируем название месяца (Date использует 0-11, поэтому month - 1)
      const dateForLabel = new Date(year, month - 1, 15);
      const label = dateForLabel.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
      months.push({ year, month, label });
    }
    return months;
  }, []);
  
  // Выбранный месяц для планируемых трат (month хранится как 1-12)
  const [selectedPlannedMonth, setSelectedPlannedMonth] = useState(() => {
    if (editingTransaction) {
      const d = new Date(editingTransaction.date);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  
  // Логируем доступные месяцы при их создании
  useEffect(() => {
    if (isPlanned) {
      console.log("[Debug] Available months:");
      availableMonths.forEach((m, i) => {
        console.log(`  ${i}: ${m.label} -> year=${m.year}, month=${m.month}`);
      });
    }
  }, [isPlanned, availableMonths]);

  // Устанавливаем заголовок в зависимости от режима
  useEffect(() => {
    navigation.setOptions({
      title: isEditing
        ? (isPlanned ? "Редактировать план" : "Редактировать операцию")
        : (isPlanned ? "Планируемая трата" : "Новая операция"),
    });
  }, [navigation, isPlanned, isEditing]);

  // Для планируемых трат — все категории (только расходы), для обычных — фильтруем по типу
  const availableCategories = isPlanned
    ? categories
    : (type === "income"
      ? categories.filter((c) => c.name === "Зарплата" || c.name === "Другое")
      : categories);

  const loadData = useCallback(async () => {
    const pendingId = consumeLastCreatedCategoryId();
    try {
      const [catData, transData, plannedData] = await Promise.all([
        api.getCategories(),
        api.getTransactions(),
        api.getPlannedExpenses(),
      ]);

      setCategories(catData);
      setTransactions(transData);
      setPlannedExpenses(plannedData);

      if (pendingId) {
        const newCat = catData.find((c) => c.id === pendingId);
        if (newCat) {
          setSelectedCategory(newCat);
        }
      } else if (catData.length > 0 && !selectedCategory) {
        const def =
          type === "income"
            ? catData.find((c) => c.name === "Зарплата") || catData[0]
            : catData[0];
        setSelectedCategory(def);
      }
    } catch {
      setCategories([]);
      setTransactions([]);
      setPlannedExpenses([]);
    }
  }, [api, type]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDeleteCategory = async () => {
    const cat = deleteModal.category;
    if (!cat) return;
    try {
      await api.deleteCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (selectedCategory?.id === cat.id) {
        const remaining = categories.filter((c) => c.id !== cat.id);
        const next = type === "income"
          ? remaining.find((c) => c.name === "Зарплата" || c.name === "Другое") || remaining[0]
          : remaining[0];
        setSelectedCategory(next ?? null);
      }
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось удалить категорию");
    } finally {
      setDeleteModal({ visible: false, category: null });
    }
  };

  useEffect(() => {
    if (
      availableCategories.length > 0 &&
      !availableCategories.find((c) => c.id === selectedCategory?.id)
    ) {
      setSelectedCategory(availableCategories[0]);
    }
  }, [type, availableCategories]);

  // Расчет бюджета для выбранной категории
  const budgetInfo = useMemo(() => {
    if (type !== "expense" || !selectedCategory) return null;

    const now = dayjs();
    const currentMonth = now.month();
    const currentYear = now.year();
    const selectedCatId = String(selectedCategory.id);

    // Сумма запланированных расходов для категории в текущем месяце
    const plannedAmount = plannedExpenses
      .filter((expense) => {
        const expenseDate = dayjs(expense.date);
        const expenseCatId = String(expense.category?.id ?? "");
        return (
          expenseCatId === selectedCatId &&
          expenseDate.month() === currentMonth &&
          expenseDate.year() === currentYear
        );
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    // Сумма фактических расходов для категории в текущем месяце
    const spentAmount = transactions
      .filter((transaction) => {
        const transactionDate = dayjs(transaction.date);
        const transCatId = String(transaction.category?.id ?? "");
        return (
          transaction.type === "expense" &&
          transCatId === selectedCatId &&
          transactionDate.month() === currentMonth &&
          transactionDate.year() === currentYear
        );
      })
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    const remaining = plannedAmount - spentAmount;
    const enteredAmount = parseFloat(amount.replace(",", ".")) || 0;
    const willRemainAfter = remaining - enteredAmount;

    return {
      planned: plannedAmount,
      spent: spentAmount,
      remaining,
      willRemainAfter,
    };
  }, [type, selectedCategory, plannedExpenses, transactions, amount]);

  const onSave = async () => {
    const num = parseFloat(amount.replace(",", "."));
    if (isNaN(num) || num <= 0) {
      Alert.alert("Ошибка", "Введите сумму");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Ошибка", "Выберите категорию");
      return;
    }
    
    // Валидация даты
    const now = new Date();
    const currentYearMonth = now.getFullYear() * 12 + (now.getMonth() + 1); // month как 1-12
    
    if (isPlanned) {
      // Для планируемых трат: месяц должен быть >= текущего
      const selectedYearMonth = selectedPlannedMonth.year * 12 + selectedPlannedMonth.month;
      if (selectedYearMonth < currentYearMonth) {
        Alert.alert("Ошибка", "Нельзя планировать траты на прошлые месяцы");
        return;
      }
    } else {
      // Для актуальных: дата должна быть <= конца текущего месяца
      const endOfCurrentMonth = dayjs().endOf("month");
      if (date.isAfter(endOfCurrentMonth, "day")) {
        Alert.alert("Ошибка", "Нельзя добавлять операции на будущие месяцы");
        return;
      }
    }
    
    setSaving(true);
    try {
      // Формируем дату для сохранения
      let dateString: string;
      if (isPlanned) {
        // Для планируемых трат: 1-е число выбранного месяца
        // selectedPlannedMonth.month уже 1-12
        const y = selectedPlannedMonth.year;
        const m = selectedPlannedMonth.month;
        dateString = `${y}-${String(m).padStart(2, "0")}-01`;
      } else {
        dateString = formatDateForInput(date);
      }
      
      // Debug
      console.log("[Save] selectedPlannedMonth:", JSON.stringify(selectedPlannedMonth));
      console.log("[Save] Date string:", dateString);
      
      const transactionData = {
        type: isPlanned ? "expense" as const : type,
        amount: num,
        category: selectedCategory,
        description: description.trim() || "",
        date: dateString,
      };
      
      if (isEditing) {
        if (isPlanned) {
          await api.updatePlannedExpense(editingTransaction.id, transactionData);
        } else {
          await api.updateTransaction(editingTransaction.id, transactionData);
        }
      } else {
        if (isPlanned) {
          await api.createPlannedExpense(transactionData);
        } else {
          await api.createTransaction(transactionData);
        }
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? (isPlanned ? "Не удалось добавить планируемую трату" : "Не удалось добавить операцию"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOperation = async () => {
    if (!editingTransaction) return;
    setDeleting(true);
    try {
      if (isPlanned) {
        await api.deletePlannedExpense(editingTransaction.id);
      } else {
        await api.deleteTransaction(editingTransaction.id);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? (isPlanned ? "Не удалось удалить планируемую трату" : "Не удалось удалить операцию"));
    } finally {
      setDeleting(false);
      setDeleteOperationModalVisible(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.bgBase },
        content: { padding: 16, paddingBottom: 32 },
        row: { flexDirection: "row", marginBottom: 20, gap: 8 },
        typeBtn: {
          flex: 1,
          paddingVertical: 12,
          alignItems: "center",
          backgroundColor: theme.bgCard,
          borderRadius: theme.radiusLg,
          paddingHorizontal: 20,
          borderWidth: 1,
          borderColor: theme.border,
        },
        typeBtnActive: {
          backgroundColor: theme.accentMuted,
          borderColor: theme.accentMuted,
        },
        typeBtnText: {
          fontSize: 15,
          fontWeight: "500",
          color: theme.textSecondary,
        },
        typeBtnTextActive: { color: "#fff", fontWeight: "600" },
        label: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.textPrimary,
          marginBottom: 8,
        },
        // Budget info section — вся плашка цветом по условию (как в веб)
        budgetBox: {
          borderRadius: theme.radiusMd,
          padding: 14,
          marginBottom: 16,
        },
        budgetBoxSuccess: { backgroundColor: theme.incomeLight },
        budgetBoxWarning: { backgroundColor: theme.expenseLight },
        budgetBoxInfo: { backgroundColor: theme.accentMutedLight },
        budgetTitle: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.textPrimary,
          marginBottom: 4,
        },
        budgetSubtitle: {
          fontSize: 12,
          color: theme.textSecondary,
          marginBottom: 8,
        },
        budgetAmount: { fontSize: 16, fontWeight: "700" },
        budgetAmountPositive: { color: theme.income },
        budgetAmountNegative: { color: theme.expense },
        budgetAmountNeutral: { color: theme.textTertiary },
        // Categories
        categories: {
          flexDirection: "row",
          flexWrap: "wrap",
          marginBottom: 8,
          gap: 8,
        },
        categoryChip: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 5,
          paddingHorizontal: 10,
          backgroundColor: theme.bgCard,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          gap: 4,
        },
        categoryChipActive: {
          backgroundColor: theme.accentMuted,
          borderColor: theme.accentMuted,
        },
        categoryChipText: { fontSize: 13, color: theme.textPrimary },
        categoryChipTextActive: { color: "#fff" },
        categoryChipWrapper: { position: "relative" as const },
        categoryDelBtn: {
          position: "absolute" as const,
          top: -4,
          right: -4,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: theme.expense,
          justifyContent: "center",
          alignItems: "center",
        },
        // Add category button
        addCategoryBtn: {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.accentMuted,
          borderStyle: "dashed",
          gap: 4,
          marginBottom: 16,
        },
        addCategoryBtnText: { fontSize: 13, color: theme.accentMuted },
        // Inputs
        input: {
          backgroundColor: theme.bgCard,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusMd,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          marginBottom: 16,
          color: theme.textPrimary,
        },
        dateBtn: {
          backgroundColor: theme.bgCard,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: theme.radiusMd,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 24,
        },
        dateBtnText: { fontSize: 16, color: theme.textPrimary, textTransform: "capitalize" },
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
        deleteOperationBtn: {
          marginTop: 12,
          borderRadius: theme.radiusMd,
          minHeight: theme.btnHeight,
          borderWidth: 1,
          borderColor: theme.expense,
          backgroundColor: theme.expenseLight,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 14,
        },
        deleteOperationBtnDisabled: { opacity: 0.7 },
        deleteOperationBtnText: { fontSize: 16, fontWeight: "600", color: theme.expense },
        // Month picker modal
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        },
        monthPickerContainer: {
          backgroundColor: theme.bgCard,
          borderRadius: theme.radiusLg,
          width: "100%",
          maxHeight: "70%",
          overflow: "hidden",
        },
        monthPickerTitle: {
          fontSize: 18,
          fontWeight: "600",
          color: theme.textPrimary,
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          textAlign: "center",
        },
        monthList: {
          maxHeight: 300,
        },
        monthItem: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        monthItemSelected: {
          backgroundColor: theme.accentMuted,
        },
        monthItemText: {
          fontSize: 16,
          color: theme.textPrimary,
          textTransform: "capitalize",
        },
        monthItemTextSelected: {
          color: "#fff",
          fontWeight: "600",
        },
        monthPickerCancel: {
          padding: 16,
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        monthPickerCancelText: {
          fontSize: 16,
          color: theme.accentMuted,
          fontWeight: "500",
        },
      }),
    [theme]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Переключатель типа - только для обычных операций */}
      {!isPlanned && (
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.typeBtn, type === "expense" && styles.typeBtnActive]}
            onPress={() => setType("expense")}
          >
            <Text
              style={[
                styles.typeBtnText,
                type === "expense" && styles.typeBtnTextActive,
              ]}
            >
              Расход
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === "income" && styles.typeBtnActive]}
            onPress={() => setType("income")}
          >
            <Text
              style={[
                styles.typeBtnText,
                type === "income" && styles.typeBtnTextActive,
              ]}
            >
              Доход
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>Сумма (₽)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
      />

      {/* Бюджет на месяц - только для обычных расходов */}
      {!isPlanned && type === "expense" && (
        <View
          style={[
            styles.budgetBox,
            budgetInfo && budgetInfo.planned > 0
              ? budgetInfo.willRemainAfter >= 0
                ? styles.budgetBoxSuccess
                : styles.budgetBoxWarning
              : styles.budgetBoxInfo,
          ]}
        >
          {budgetInfo && budgetInfo.planned > 0 ? (
            <>
              <Text style={styles.budgetTitle}>Бюджет на месяц</Text>
              <Text style={styles.budgetSubtitle}>
                Запланировано: {budgetInfo.planned.toLocaleString("ru-RU")} ₽ •
                Потрачено: {budgetInfo.spent.toLocaleString("ru-RU")} ₽
              </Text>
              <Text
                style={[
                  styles.budgetAmount,
                  budgetInfo.willRemainAfter >= 0
                    ? styles.budgetAmountPositive
                    : styles.budgetAmountNegative,
                ]}
              >
                {amount && parseFloat(amount.replace(",", ".")) > 0
                  ? `Останется: ${budgetInfo.willRemainAfter.toLocaleString(
                      "ru-RU"
                    )} ₽`
                  : `Осталось: ${budgetInfo.remaining.toLocaleString(
                      "ru-RU"
                    )} ₽`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.budgetTitle}>Бюджет на месяц</Text>
              <Text style={styles.budgetSubtitle}>
                Сумма не запланирована для этой категории
              </Text>
              <Text style={[styles.budgetAmount, styles.budgetAmountNeutral]}>
                —
              </Text>
            </>
          )}
        </View>
      )}

      <Text style={styles.label}>Категория</Text>
      <View style={styles.categories}>
        {availableCategories.map((c) => {
          const isActive = selectedCategory?.id === c.id;
          const canDelete = !DEFAULT_NAMES.includes(c.name);
          return (
            <View key={c.id} style={styles.categoryChipWrapper}>
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(c)}
              >
                <Ionicons
                  name={getIoniconsName(c.icon)}
                  size={16}
                  color={isActive ? "#fff" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
              {canDelete && (
                <TouchableOpacity
                  style={styles.categoryDelBtn}
                  onPress={() => setDeleteModal({ visible: true, category: c })}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <ConfirmModal
        visible={deleteModal.visible}
        title="Удалить категорию?"
        message={deleteModal.category ? `Удалить «${deleteModal.category.name}»?` : ""}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteModal({ visible: false, category: null })}
      />

      {/* Добавить категорию */}
      <TouchableOpacity
        style={styles.addCategoryBtn}
        onPress={() => navigation.navigate("AddCategory")}
      >
        <Ionicons name="add-outline" size={18} color={theme.accentMuted} />
        <Text style={styles.addCategoryBtnText}>Добавить категорию</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Описание (необязательно)</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Описание"
        placeholderTextColor={theme.textTertiary}
      />

      <Text style={styles.label}>{isPlanned ? "Месяц" : "Дата"}</Text>
      {isPlanned ? (
        // Выбор месяца для планируемых трат
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowMonthPicker(true)}
        >
          <Text style={styles.dateBtnText}>{formatMonthDisplay(selectedPlannedMonth.year, selectedPlannedMonth.month)}</Text>
        </TouchableOpacity>
      ) : (
        // Выбор даты для обычных операций
        <>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateBtnText}>{date.format("DD.MM.YYYY")}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date.toDate()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={dayjs().endOf("month").toDate()}
              onChange={(_, d) => {
                setShowDatePicker(false);
                if (d) setDate(dayjs(d));
              }}
            />
          )}
        </>
      )}

      {/* Модалка выбора месяца */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={styles.monthPickerContainer}>
            <Text style={styles.monthPickerTitle}>Выберите месяц</Text>
            <ScrollView style={styles.monthList}>
              {availableMonths.map((m) => {
                const isSelected = selectedPlannedMonth.year === m.year && selectedPlannedMonth.month === m.month;
                return (
                  <TouchableOpacity
                    key={`${m.year}-${m.month}`}
                    style={[styles.monthItem, isSelected && styles.monthItemSelected]}
                    onPress={() => {
                      console.log("[MonthPicker] Selected:", m.label, "year:", m.year, "month:", m.month);
                      setSelectedPlannedMonth({ year: m.year, month: m.month });
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text style={[styles.monthItemText, isSelected && styles.monthItemTextSelected]}>
                      {m.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.monthPickerCancel}
              onPress={() => setShowMonthPicker(false)}
            >
              <Text style={styles.monthPickerCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving || deleting}
      >
        <Text style={styles.saveBtnText}>
          {saving ? "Сохранение…" : isEditing ? "Сохранить" : isPlanned ? "Добавить" : "Сохранить"}
        </Text>
      </TouchableOpacity>

      {isEditing && (
        <TouchableOpacity
          style={[styles.deleteOperationBtn, deleting && styles.deleteOperationBtnDisabled]}
          onPress={() => setDeleteOperationModalVisible(true)}
          disabled={saving || deleting}
        >
          <Text style={styles.deleteOperationBtnText}>
            {deleting ? "Удаление…" : isPlanned ? "Удалить план" : "Удалить операцию"}
          </Text>
        </TouchableOpacity>
      )}

      <ConfirmModal
        visible={deleteOperationModalVisible}
        title={isPlanned ? "Удалить планируемую трату?" : "Удалить операцию?"}
        message="Это действие нельзя отменить."
        onConfirm={handleDeleteOperation}
        onCancel={() => setDeleteOperationModalVisible(false)}
      />
    </ScrollView>
  );
}
