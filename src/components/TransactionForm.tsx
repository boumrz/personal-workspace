import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  DatePicker,
  Space,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
import CategoryForm from "./CategoryForm";
import * as styles from "./TransactionForm.module.css";

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  type: "actual" | "planned";
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  open,
  onClose,
  type,
}) => {
  const { addTransaction, addPlannedExpense, categories } = useFinance();
  const [form] = Form.useForm();
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "expense"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const handleCategoryCreated = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowCategoryForm(false);
  };

  const availableCategories =
    transactionType === "income"
      ? categories.filter((c) => c.name === "Зарплата" || c.name === "Другое")
      : categories;

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(
        availableCategories[0]?.id || categories[0]?.id || ""
      );
    }
  }, [categories]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const values = await form.validateFields();
      const category = categories.find((c) => c.id === selectedCategory);
      if (!category) return;

      const transaction = {
        type: transactionType,
        amount: values.amount,
        category,
        description: values.description || "",
        date: values.date.format("YYYY-MM-DD"),
      };

      if (type === "planned") {
        await addPlannedExpense(transaction);
      } else {
        await addTransaction(transaction);
      }

      form.resetFields();
      onClose();
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={type === "planned" ? "Планируемая трата" : "Новая операция"}
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Отмена
        </Button>,
        <Button key="submit" type="primary" onClick={handleSubmit}>
          Добавить
        </Button>,
      ]}
      width={window.innerWidth < 768 ? "100%" : 500}
      style={window.innerWidth < 768 ? { top: 0, paddingBottom: 0 } : undefined}
    >
      <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
        {type === "actual" && (
          <Form.Item label="Тип операции" name="type">
            <Radio.Group
              value={transactionType}
              onChange={(e: any) => {
                setTransactionType(e.target.value);
                const firstAvailable =
                  e.target.value === "income"
                    ? categories.find(
                        (c) => c.name === "Зарплата" || c.name === "Другое"
                      )
                    : categories[0];
                if (firstAvailable) {
                  setSelectedCategory(firstAvailable.id);
                }
              }}
            >
              <Radio value="income">Доход</Radio>
              <Radio value="expense">Расход</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        <Form.Item
          label="Сумма (₽)"
          name="amount"
          rules={[{ required: true, message: "Введите сумму" }]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            step={0.01}
            precision={2}
            placeholder="0"
          />
        </Form.Item>

        <Form.Item label="Категория" required>
          <Space wrap size={8}>
            {availableCategories.map((category) => (
              <Button
                key={category.id}
                type={selectedCategory === category.id ? "primary" : "default"}
                onClick={() => setSelectedCategory(category.id)}
                style={
                  selectedCategory === category.id
                    ? {
                        backgroundColor: category.color,
                        borderColor: category.color,
                      }
                    : {}
                }
              >
                <span>{category.icon}</span> {category.name}
              </Button>
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setShowCategoryForm(true)}
              className={styles.addCategoryButton}
            >
              Добавить категорию
            </Button>
          </Space>
        </Form.Item>

        <Form.Item label="Описание" name="description">
          <Input placeholder="Введите описание" />
        </Form.Item>

        <Form.Item
          label="Дата"
          name="date"
          rules={[{ required: true, message: "Выберите дату" }]}
        >
          <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
        </Form.Item>
      </Form>

      <CategoryForm
        open={showCategoryForm}
        onClose={() => setShowCategoryForm(false)}
        transactionType={transactionType}
        onCategoryCreated={handleCategoryCreated}
      />
    </Modal>
  );
};

export default TransactionForm;
