import React, { useState, useEffect } from "react";
import { Drawer, Button, Tag, Space } from "antd";
import { useFinance } from "../context/FinanceContext";
import IconRenderer from "./IconRenderer";
import * as styles from "./CategoryFilter.module.css";

interface CategoryFilterProps {
  selectedCategories: string[];
  onSelectCategories: (categoryIds: string[]) => void;
  open: boolean;
  onClose: () => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategories,
  onSelectCategories,
  open,
  onClose,
}) => {
  const { categories } = useFinance();
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>(selectedCategories);

  // Синхронизируем временное состояние с выбранными категориями при открытии drawer
  useEffect(() => {
    if (open) {
      setTempSelectedCategories(selectedCategories);
    }
  }, [open, selectedCategories]);

  const handleApply = () => {
    onSelectCategories(tempSelectedCategories);
    onClose();
  };

  const handleCategoryClick = (categoryId: string | null) => {
    if (categoryId === null) {
      // Если кликнули на "Все"
      if (tempSelectedCategories.includes("all")) {
        // Если уже выбрано "Все", снимаем выбор
        setTempSelectedCategories([]);
      } else {
        // Иначе выбираем только "Все" (снимаем все остальные)
        setTempSelectedCategories(["all"]);
      }
    } else {
      // Если кликнули на конкретную категорию
      if (tempSelectedCategories.includes("all")) {
        // Если было выбрано "Все", снимаем его и выбираем только эту категорию
        setTempSelectedCategories([categoryId]);
      } else if (tempSelectedCategories.includes(categoryId)) {
        // Если категория уже выбрана, снимаем её
        const newSelection = tempSelectedCategories.filter((id) => id !== categoryId);
        setTempSelectedCategories(newSelection);
      } else {
        // Добавляем категорию к выбранным
        setTempSelectedCategories([...tempSelectedCategories, categoryId]);
      }
    }
  };

  const isAllSelected = tempSelectedCategories.includes("all");
  const isCategorySelected = (categoryId: string) => tempSelectedCategories.includes(categoryId);

  return (
    <Drawer
      title="Фильтр по категориям"
      placement="right"
      onClose={onClose}
      open={open}
      width="100%"
      styles={{
        body: {
          padding: "16px",
        },
      }}
      footer={
        <div className={styles.drawerFooter}>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" onClick={handleApply}>
            Применить
          </Button>
        </div>
      }
    >
      <div className={styles.categoriesList}>
        <Space size={[8, 8]} wrap className={styles.tagsContainer}>
          <Tag
            className={styles.categoryTag}
            onClick={() => handleCategoryClick(null)}
            style={{
              cursor: "pointer",
              padding: "8px 16px",
              fontSize: "14px",
              margin: 0,
              border: isAllSelected
                ? "1px solid var(--accent)"
                : "1px solid var(--border-strong)",
              backgroundColor: isAllSelected ? "var(--accent)" : "var(--bg-card)",
              color: isAllSelected ? "#fff" : "var(--text-primary)",
            }}
          >
            Все
          </Tag>
          {categories.map((category) => (
            <Tag
              key={category.id}
              className={styles.categoryTag}
              onClick={() => handleCategoryClick(category.id)}
              style={{
                cursor: "pointer",
                padding: "8px 16px",
                fontSize: "14px",
                margin: 0,
                border: isCategorySelected(category.id)
                  ? `1px solid ${category.color}`
                  : "1px solid var(--border-strong)",
                backgroundColor: isCategorySelected(category.id)
                  ? category.color
                  : "var(--bg-card)",
                color: isCategorySelected(category.id) ? "#fff" : "var(--text-primary)",
              }}
            >
              <span className={styles.categoryIcon}>
                <IconRenderer iconName={category.icon} size={14} />
              </span>
              {category.name}
            </Tag>
          ))}
        </Space>
      </div>
    </Drawer>
  );
};

export default CategoryFilter;
