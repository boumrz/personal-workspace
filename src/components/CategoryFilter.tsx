import React, { useState, useRef, useEffect } from "react";
import { Space, Button, Popconfirm, Popover } from "antd";
import { DeleteOutlined, MoreOutlined } from "@ant-design/icons";
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
  const [popoverVisible, setPopoverVisible] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
    setPopoverVisible(null);
  };

  const handlePopconfirmOpenChange = (categoryId: string, visible: boolean) => {
    setPopconfirmVisible(visible ? categoryId : null);
    if (!visible) {
      // При закрытии модалки скрываем кнопку удаления
      setHoveredCategory(null);
    }
  };

  const handleLongPressStart = (categoryId: string) => {
    if (isMobile) {
      longPressTimerRef.current = setTimeout(() => {
        setPopconfirmVisible(categoryId);
      }, 500); // 500ms для долгого нажатия
    }
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMenuClick = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverVisible(popoverVisible === categoryId ? null : categoryId);
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
              onMouseEnter={() => !isMobile && handleMouseEnter(category.id)}
              onMouseLeave={() => !isMobile && handleMouseLeave(category.id)}
              onTouchStart={() =>
                canDelete && handleLongPressStart(category.id)
              }
              onTouchEnd={handleLongPressEnd}
              onTouchCancel={handleLongPressEnd}
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
              {/* Кнопка удаления для десктопа (hover) */}
              {showDelete && !isMobile && (
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

              {/* Кнопка меню для мобильных устройств */}
              {canDelete && isMobile && (
                <Popover
                  content={
                    <div className={styles.mobileMenu}>
                      <Popconfirm
                        title="Удалить категорию?"
                        description="Эта категория будет удалена. Это действие нельзя отменить."
                        onConfirm={(e) => handleDelete(category.id, e!)}
                        onCancel={() => setPopoverVisible(null)}
                        okText="Да"
                        cancelText="Нет"
                        placement="top"
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          block
                          className={styles.mobileDeleteButton}
                        >
                          Удалить категорию
                        </Button>
                      </Popconfirm>
                    </div>
                  }
                  trigger="click"
                  open={popoverVisible === category.id}
                  onOpenChange={(visible) =>
                    setPopoverVisible(visible ? category.id : null)
                  }
                  placement="bottomRight"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    className={styles.mobileMenuButton}
                    onClick={(e) => handleMenuClick(category.id, e)}
                  />
                </Popover>
              )}
            </div>
          );
        })}
      </Space>
    </div>
  );
};

export default CategoryFilter;
