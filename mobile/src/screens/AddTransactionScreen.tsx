import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";
import type { Category, Transaction } from "@finance-assistant/shared";

function formatDateForInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AddTransactionScreen({ navigation }: any) {
  const { api } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableCategories = type === "income"
    ? categories.filter((c) => c.name === "Зарплата" || c.name === "Другое")
    : categories;

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getCategories();
        setCategories(data);
        if (data.length > 0 && !selectedCategory) {
          const def = type === "income"
            ? data.find((c) => c.name === "Зарплата") || data[0]
            : data[0];
          setSelectedCategory(def);
        }
      } catch {
        setCategories([]);
      }
    })();
  }, [api]);

  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.find((c) => c.id === selectedCategory?.id)) {
      setSelectedCategory(availableCategories[0]);
    }
  }, [type, availableCategories]);

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
    setSaving(true);
    try {
      await api.createTransaction({
        type,
        amount: num,
        category: selectedCategory,
        description: description.trim() || "",
        date: formatDateForInput(date),
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось добавить операцию");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.typeBtn, type === "expense" && styles.typeBtnActive]}
          onPress={() => setType("expense")}
        >
          <Text style={[styles.typeBtnText, type === "expense" && styles.typeBtnTextActive]}>
            Расход
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === "income" && styles.typeBtnActive]}
          onPress={() => setType("income")}
        >
          <Text style={[styles.typeBtnText, type === "income" && styles.typeBtnTextActive]}>
            Доход
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Категория</Text>
      <View style={styles.categories}>
        {availableCategories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.categoryChip,
              selectedCategory?.id === c.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(c)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory?.id === c.id && styles.categoryChipTextActive,
              ]}
              numberOfLines={1}
            >
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Сумма (₽)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Описание (необязательно)</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Описание"
      />

      <Text style={styles.label}>Дата</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.dateBtnText}>{formatDateForInput(date)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, d) => {
            setShowDatePicker(false);
            if (d) setDate(d);
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? "Сохранение…" : "Сохранить"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBase },
  content: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: "row", marginBottom: 20, gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: theme.bgSurface,
    borderRadius: theme.radiusLg,
    paddingHorizontal: 20,
  },
  typeBtnActive: {
    backgroundColor: theme.bgCard,
    shadowColor: theme.shadowMd,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  typeBtnText: { fontSize: 15, fontWeight: "500", color: theme.textSecondary },
  typeBtnTextActive: { color: theme.textPrimary, fontWeight: "600" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textPrimary,
    marginBottom: 8,
  },
  categories: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16, gap: 8 },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryChipActive: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.accentMuted,
  },
  categoryChipText: { fontSize: 14, color: theme.textPrimary },
  categoryChipTextActive: { color: "#fff" },
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
  dateBtnText: { fontSize: 16, color: theme.textPrimary },
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
});
