import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";
import type { Category } from "@finance-assistant/shared";

export default function CategoryFilterScreen({ navigation, route }: any) {
  const { api } = useAuth();
  const { selectedCategories: initialSelected, onApply } = route.params;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(initialSelected || ["all"]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getCategories();
        setCategories(data);
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  const handleSelect = (categoryId: string | null) => {
    if (categoryId === null) {
      setSelected(["all"]);
    } else {
      let newSelection: string[];
      if (selected.includes(categoryId)) {
        newSelection = selected.filter((id) => id !== categoryId && id !== "all");
      } else {
        newSelection = [...selected.filter((id) => id !== "all"), categoryId];
      }
      if (newSelection.length === 0) {
        newSelection = ["all"];
      }
      setSelected(newSelection);
    }
  };

  const handleApply = () => {
    onApply(selected);
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.accentMuted} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.categoryTag, selected.includes("all") && styles.categoryTagActive]}
          onPress={() => handleSelect(null)}
        >
          <Text style={[styles.categoryTagText, selected.includes("all") && styles.categoryTagTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        {categories.map((category) => {
          const isSelected = selected.includes(category.id);
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryTag,
                isSelected && { backgroundColor: category.color, borderColor: category.color },
              ]}
              onPress={() => handleSelect(category.id)}
            >
              <Ionicons
                name="pricetag"
                size={14}
                color={isSelected ? "#fff" : category.color}
                style={styles.categoryTagIcon}
              />
              <Text style={[styles.categoryTagText, isSelected && styles.categoryTagTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
          <Text style={styles.applyBtnText}>Применить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bgBase },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  content: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 16,
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radiusMd,
    backgroundColor: theme.bgCard,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  categoryTagActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  categoryTagIcon: {
    marginRight: 8,
  },
  categoryTagText: {
    fontSize: 15,
    color: theme.textPrimary,
  },
  categoryTagTextActive: {
    color: "#fff",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.bgCard,
  },
  applyBtn: {
    backgroundColor: theme.accentMuted,
    borderRadius: theme.radiusMd,
    paddingVertical: 14,
    minHeight: theme.btnHeight,
    justifyContent: "center",
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
