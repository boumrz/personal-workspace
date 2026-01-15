import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  DatePicker,
  Space,
  Tooltip,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
import CategoryForm from "./CategoryForm";
import IconRenderer from "./IconRenderer";
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

  const availableCategories = useMemo(
    () =>
      transactionType === "income"
        ? categories.filter((c) => c.name === "Зарплата" || c.name === "Другое")
        : categories,
    [transactionType, categories]
  );

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(
        availableCategories[0]?.id || categories[0]?.id || ""
      );
    }
  }, [categories, availableCategories, selectedCategory]);

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

  // Функция для блокировки дат из будущих месяцев (только для актуальных операций)
  const disabledDate = (current: dayjs.Dayjs | null) => {
    if (!current || type !== "actual") {
      return false; // Для планируемых операций не блокируем даты
    }

    // Получаем конец текущего месяца
    const endOfCurrentMonth = dayjs().endOf("month");

    // Блокируем даты, которые позже конца текущего месяца
    return current.isAfter(endOfCurrentMonth, "day");
  };

  // Функция для кастомного рендеринга дат с тултипами
  // Важно: возвращаем правильную структуру для сохранения стандартного поведения Ant Design
  const dateRender = (current: dayjs.Dayjs) => {
    // Проверяем, заблокирована ли дата
    const isDisabled = disabledDate(current);

    // Для заблокированных дат добавляем тултип
    const content = isDisabled && type === "actual" ? (
      <Tooltip title="Нельзя добавлять операции на будущие месяцы">
        <div style={{ width: "100%", height: "100%", cursor: "not-allowed" }}>
          {current.date()}
        </div>
      </Tooltip>
    ) : (
      <div style={{ width: "100%", height: "100%" }}>{current.date()}</div>
    );

    // Возвращаем содержимое, обернутое в стандартную структуру Ant Design
    // Это сохраняет стандартные классы и поведение (выделение текущего дня, выбранной даты и т.д.)
    return (
      <div className="ant-picker-cell-inner" style={{ width: "100%", height: "100%" }}>
        {content}
      </div>
    );
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
      <Form form={form} layout="vertical" initialValues={{ date: dayjs(), type: "expense" }}>
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
              <Radio value="expense">Расход</Radio>
              <Radio value="income">Доход</Radio>
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
                <IconRenderer iconName={category.icon} size={16} /> {category.name}
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
          rules={[
            { required: true, message: "Выберите дату" },
            {
              validator: (_, value) => {
                if (!value) {
                  return Promise.resolve();
                }

                // Для актуальных операций проверяем, что дата не в будущем месяце
                if (type === "actual") {
                  const endOfCurrentMonth = dayjs().endOf("month");
                  const selectedDate = dayjs(value);

                  if (selectedDate.isAfter(endOfCurrentMonth, "day")) {
                    return Promise.reject(
                      new Error("Нельзя добавлять операции на будущие месяцы")
                    );
                  }
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <DatePicker
            style={{ width: "100%" }}
            format="DD.MM.YYYY"
            disabledDate={disabledDate}
            dateRender={type === "actual" ? dateRender : undefined}
          />
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
