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
  // По умолчанию "Все" если ничего не выбрано
  const getInitialSelection = (selection: string[]) => {
    return selection.length === 0 ? ["all"] : selection;
  };
  
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>(
    getInitialSelection(selectedCategories)
  );

  // Синхронизируем временное состояние с выбранными категориями при открытии drawer
  useEffect(() => {
    if (open) {
      setTempSelectedCategories(getInitialSelection(selectedCategories));
    }
  }, [open, selectedCategories]);

  const handleApply = () => {
    onSelectCategories(tempSelectedCategories);
    onClose();
  };

  const handleCategoryClick = (categoryId: string | null) => {
    if (categoryId === null) {
      // Если кликнули на "Все" — выбираем только "Все"
      setTempSelectedCategories(["all"]);
    } else {
      // Если кликнули на конкретную категорию
      let newSelection: string[];
      
      if (tempSelectedCategories.includes(categoryId)) {
        // Если категория уже выбрана, снимаем её
        newSelection = tempSelectedCategories.filter((id) => id !== categoryId && id !== "all");
      } else {
        // Добавляем категорию, убираем "Все"
        newSelection = [...tempSelectedCategories.filter((id) => id !== "all"), categoryId];
      }
      
      // Если ничего не выбрано — автоматически выбираем "Все"
      if (newSelection.length === 0) {
        newSelection = ["all"];
      }
      
      setTempSelectedCategories(newSelection);
    }
  };

  const isAllSelected = tempSelectedCategories.includes("all");
  const isCategorySelected = (categoryId: string) => tempSelectedCategories.includes(categoryId);

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <Drawer
      title="Фильтр по категориям"
      placement="right"
      onClose={onClose}
      open={open}
      width={isMobile ? "100%" : undefined}
      styles={{
        body: { padding: "16px" },
        wrapper: isMobile ? { width: "100%", maxWidth: "100vw" } : undefined,
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
