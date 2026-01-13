import React, { useState, useRef } from "react";
import { Space, Button, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import IconRenderer from "./IconRenderer";
import * as styles from "./CategoryFilter.module.css";

interface CategoryFilterProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const { categories, deleteCategory } = useFinance();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [popconfirmVisible, setPopconfirmVisible] = useState<string | null>(
    null
  );
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Базовые категории, которые нельзя удалить
  const defaultCategoryNames = [
    "Продукты",
    "Транспорт",
    "Развлечения",
    "Здоровье",
    "Одежда",
    "Жилье",
    "Зарплата",
    "Другое",
  ];

  const isDefaultCategory = (categoryName: string) => {
    return defaultCategoryNames.includes(categoryName);
  };

  const handleDelete = async (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteCategory(categoryId);
      if (selectedCategory === categoryId) {
        onSelectCategory(null);
      }
      setHoveredCategory(null);
      setPopconfirmVisible(null);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    } catch (error: any) {
      // Показываем более понятное сообщение об ошибке
      const errorMessage =
        error?.message ||
        error?.response?.data?.error ||
        "Ошибка при удалении категории";
      alert(errorMessage);
      setPopconfirmVisible(null);
    }
  };

  const handleMouseEnter = (categoryId: string) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredCategory(categoryId);
  };

  const handleMouseLeave = (categoryId: string) => {
    // Не скрываем, если модалка открыта
    if (popconfirmVisible === categoryId) {
      return;
    }
    // Добавляем задержку перед скрытием, чтобы пользователь мог навести на кнопку удаления
    hideTimeoutRef.current = setTimeout(() => {
      if (popconfirmVisible !== categoryId) {
        setHoveredCategory(null);
      }
    }, 300);
  };

  const handleDeleteButtonClick = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPopconfirmVisible(categoryId);
  };

  const handlePopconfirmOpenChange = (categoryId: string, visible: boolean) => {
    setPopconfirmVisible(visible ? categoryId : null);
    if (!visible) {
      // При закрытии модалки скрываем кнопку удаления
      setHoveredCategory(null);
    }
  };

  return (
    <div className={styles.filter}>
      <Space size={8} wrap>
        <Button
          type={selectedCategory === null ? "primary" : "default"}
          onClick={() => onSelectCategory(null)}
        >
          Все
        </Button>
        {categories.map((category) => {
          const canDelete = !isDefaultCategory(category.name);
          const showDelete = hoveredCategory === category.id && canDelete;

          return (
            <div
              key={category.id}
              ref={(el) => (wrapperRefs.current[category.id] = el)}
              className={styles.categoryWrapper}
              onMouseEnter={() => handleMouseEnter(category.id)}
              onMouseLeave={() => handleMouseLeave(category.id)}
            >
              <Button
                type={selectedCategory === category.id ? "primary" : "default"}
                onClick={() =>
                  onSelectCategory(
                    selectedCategory === category.id ? null : category.id
                  )
                }
                style={
                  selectedCategory === category.id
                    ? {
                        backgroundColor: category.color,
                        borderColor: category.color,
                      }
                    : {}
                }
              >
                <span className={styles.categoryIcon}>
                  <IconRenderer iconName={category.icon} size={16} />
                </span>
                {category.name}
              </Button>
              {showDelete && (
                <Popconfirm
                  title="Удалить категорию?"
                  description="Эта категория будет удалена. Это действие нельзя отменить."
                  onConfirm={(e) => handleDelete(category.id, e!)}
                  onCancel={(e) => {
                    e?.stopPropagation();
                    setPopconfirmVisible(null);
                    setHoveredCategory(null);
                  }}
                  onOpenChange={(visible) =>
                    handlePopconfirmOpenChange(category.id, visible)
                  }
                  okText="Да"
                  cancelText="Нет"
                  placement="top"
                  overlayClassName={styles.popconfirmOverlay}
                  getPopupContainer={() =>
                    wrapperRefs.current[category.id] || document.body
                  }
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0.1}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    className={styles.deleteButton}
                    onClick={(e) => handleDeleteButtonClick(category.id, e)}
                  />
                </Popconfirm>
              )}
            </div>
          );
        })}
      </Space>
    </div>
  );
};

export default CategoryFilter;
