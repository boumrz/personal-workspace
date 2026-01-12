import React, { useState } from "react";
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
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
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
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0].id
  );

  const availableCategories =
    transactionType === "income"
      ? categories.filter((c) => c.name === "Зарплата" || c.name === "Другое")
      : categories;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const category = categories.find((c) => c.id === selectedCategory);
      if (!category) return;

      const transaction = {
        id: Date.now().toString(),
        type: transactionType,
        amount: values.amount,
        category,
        description: values.description || "",
        date: values.date.format("YYYY-MM-DD"),
      };

      if (type === "planned") {
        addPlannedExpense(transaction);
      } else {
        addTransaction(transaction);
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
                setSelectedCategory(categories[0].id);
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
    </Modal>
  );
};

export default TransactionForm;
