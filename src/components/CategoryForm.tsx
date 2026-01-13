import React, { useState } from "react";
import { Modal, Form, Input, Button } from "antd";
import { useFinance } from "../context/FinanceContext";
import * as styles from "./CategoryForm.module.css";

interface CategoryFormProps {
  open: boolean;
  onClose: () => void;
  transactionType?: "income" | "expense";
  onCategoryCreated?: (categoryId: string) => void;
}

const AVAILABLE_ICONS = [
  "🍔", "🚗", "🎬", "🏥", "👕", "🏠", "💰", "📦",
  "🍕", "☕", "🍺", "🎮", "📱", "💻", "✈️", "🏖️",
  "🎓", "💊", "🎁", "💳", "🏋️", "🎨", "📚", "🎵",
  "🍰", "🥗", "🍷", "🚌", "🚇", "🚲", "⛽", "🛒",
  "💄", "🧴", "🧹", "🔧", "💡", "🌡️", "📺", "🔌",
  "💼", "📊", "📈", "💵", "💴", "💶", "💷", "💸"
];

const COLOR_PALETTE = [
  "#FF8A65", "#64B5F6", "#BA68C8", "#81C784", "#FFB74D", "#90CAF9",
  "#66BB6A", "#90A4AE", "#F06292", "#4DB6AC", "#FFA726", "#7986CB",
  "#AED581", "#FFD54F", "#FF8A80", "#80CBC4", "#CE93D8", "#A5D6A7",
  "#FFCC80", "#B39DDB", "#C5E1A5", "#FFE082", "#EF9A9A", "#90CAF9",
  "#FFAB91", "#81C784", "#FFD54F", "#BA68C8", "#64B5F6", "#FF8A65"
];

const CategoryForm: React.FC<CategoryFormProps> = ({
  open,
  onClose,
  transactionType = "expense",
  onCategoryCreated,
}) => {
  const { addCategory } = useFinance();
  const [form] = Form.useForm();
  const [selectedColor, setSelectedColor] = useState<string>(COLOR_PALETTE[0]);
  const [selectedIcon, setSelectedIcon] = useState<string>(AVAILABLE_ICONS[0]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const newCategory = await addCategory({
        name: values.name,
        color: selectedColor,
        icon: selectedIcon,
      });
      
      if (onCategoryCreated) {
        onCategoryCreated(newCategory.id);
      }
      
      form.resetFields();
      setSelectedColor(COLOR_PALETTE[0]);
      setSelectedIcon(AVAILABLE_ICONS[0]);
      onClose();
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedColor(COLOR_PALETTE[0]);
    setSelectedIcon(AVAILABLE_ICONS[0]);
    onClose();
  };

  return (
    <Modal
      title="Создать категорию"
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Отмена
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          Создать
        </Button>,
      ]}
      width={window.innerWidth < 768 ? "100%" : 500}
      style={window.innerWidth < 768 ? { top: 0, paddingBottom: 0 } : undefined}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Название категории"
          name="name"
          rules={[{ required: true, message: "Введите название категории" }]}
        >
          <Input placeholder="Например: Кафе" />
        </Form.Item>

        <Form.Item label="Иконка">
          <div className={styles.iconGrid}>
            {AVAILABLE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`${styles.iconButton} ${
                  selectedIcon === icon ? styles.iconButtonActive : ""
                }`}
                onClick={() => setSelectedIcon(icon)}
                style={
                  selectedIcon === icon
                    ? { backgroundColor: selectedColor, borderColor: selectedColor }
                    : {}
                }
              >
                {icon}
              </button>
            ))}
          </div>
        </Form.Item>

        <Form.Item label="Цвет">
          <div className={styles.colorGrid}>
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={`${styles.colorButton} ${
                  selectedColor === color ? styles.colorButtonActive : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              >
                {selectedColor === color && <span className={styles.checkmark}>✓</span>}
              </button>
            ))}
          </div>
        </Form.Item>

        <div className={styles.preview}>
          <div
            className={styles.previewBadge}
            style={{ backgroundColor: selectedColor }}
          >
            <span className={styles.previewIcon}>{selectedIcon}</span>
            <span className={styles.previewName}>
              {form.getFieldValue("name") || "Название категории"}
            </span>
          </div>
        </div>
      </Form>
    </Modal>
  );
};

export default CategoryForm;
