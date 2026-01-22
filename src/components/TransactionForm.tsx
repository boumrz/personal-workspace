import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Drawer,
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  DatePicker,
  Space,
  Tooltip,
  Popconfirm,
  Alert,
} from "antd";
import { PlusOutlined, CloseOutlined } from "@ant-design/icons";
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
  const { addTransaction, addPlannedExpense, categories, deleteCategory, transactions, plannedExpenses } = useFinance();
  const [form] = Form.useForm();
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "expense"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState<number | null>(null);

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

  const handleDeleteCategory = async (categoryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await deleteCategory(categoryId);
      // Если удаленная категория была выбрана, сбрасываем выбор
      if (selectedCategory === categoryId) {
        const remainingCategories = availableCategories.filter(c => c.id !== categoryId);
        if (remainingCategories.length > 0) {
          setSelectedCategory(remainingCategories[0].id);
        } else {
          setSelectedCategory("");
        }
      }
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.response?.data?.error ||
        "Ошибка при удалении категории";
      alert(errorMessage);
    }
  };

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);


  // Сброс введенной суммы при открытии/закрытии формы
  useEffect(() => {
    if (!open) {
      setEnteredAmount(null);
    }
  }, [open]);

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

  // Функция для расчета остатка бюджета по категории за текущий месяц
  const calculateBudgetRemaining = useMemo(() => {
    if (type !== "actual" || transactionType !== "expense" || !selectedCategory) {
      return null;
    }

    const now = dayjs();
    const currentMonth = now.month();
    const currentYear = now.year();

    // Сумма запланированных расходов для категории в текущем месяце
    const plannedAmount = plannedExpenses
      .filter((expense) => {
        const expenseDate = dayjs(expense.date);
        return (
          expense.category.id === selectedCategory &&
          expenseDate.month() === currentMonth &&
          expenseDate.year() === currentYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    // Сумма фактических расходов для категории в текущем месяце
    const spentAmount = transactions
      .filter((transaction) => {
        const transactionDate = dayjs(transaction.date);
        return (
          transaction.type === "expense" &&
          transaction.category.id === selectedCategory &&
          transactionDate.month() === currentMonth &&
          transactionDate.year() === currentYear
        );
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    // Остаток бюджета
    const remaining = plannedAmount - spentAmount;

    return {
      planned: plannedAmount,
      spent: spentAmount,
      remaining: remaining,
      willRemainAfter: enteredAmount ? remaining - enteredAmount : remaining,
    };
  }, [type, transactionType, selectedCategory, plannedExpenses, transactions, enteredAmount]);

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
      setEnteredAmount(null);
      onClose();
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setEnteredAmount(null);
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
    const content =
      isDisabled && type === "actual" ? (
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
      <div
        className="ant-picker-cell-inner"
        style={{ width: "100%", height: "100%" }}
      >
        {content}
      </div>
    );
  };

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ date: dayjs(), type: "expense" }}
    >
      {type === "actual" && (
        <Form.Item label="Тип операции" name="type">
          <Radio.Group
            value={transactionType}
            onChange={(e: any) => {
              setTransactionType(e.target.value);
              setEnteredAmount(null);
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
          onChange={(value) => setEnteredAmount(value)}
        />
      </Form.Item>

      {/* Отображение остатка бюджета */}
      {type === "actual" && transactionType === "expense" && calculateBudgetRemaining && calculateBudgetRemaining.planned > 0 && (
        <Form.Item>
          <Alert
            message={
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  Остаток бюджета на месяц
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Запланировано: {calculateBudgetRemaining.planned.toLocaleString("ru-RU")} ₽
                  {" • "}
                  Потрачено: {calculateBudgetRemaining.spent.toLocaleString("ru-RU")} ₽
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color:
                      calculateBudgetRemaining.willRemainAfter >= 0
                        ? "var(--income)"
                        : "var(--expense)",
                  }}
                >
                  {enteredAmount
                    ? `Останется после операции: ${calculateBudgetRemaining.willRemainAfter.toLocaleString("ru-RU")} ₽`
                    : `Осталось: ${calculateBudgetRemaining.remaining.toLocaleString("ru-RU")} ₽`}
                </div>
              </div>
            }
            type={
              calculateBudgetRemaining.willRemainAfter >= 0
                ? "success"
                : "warning"
            }
            showIcon
            style={{ marginTop: 8 }}
          />
        </Form.Item>
      )}

      <Form.Item label="Категория" required>
        <Space wrap size={12} className={styles.categoriesContainer}>
          {availableCategories.map((category) => {
            const canDelete = !isDefaultCategory(category.name);
            return (
              <div key={category.id} className={styles.categoryWrapper}>
                <Button
                  type={selectedCategory === category.id ? "primary" : "default"}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setEnteredAmount(null);
                  }}
                  className={styles.categoryButton}
                  style={
                    selectedCategory === category.id
                      ? {
                          backgroundColor: category.color,
                          borderColor: category.color,
                        }
                      : {}
                  }
                >
                  <IconRenderer iconName={category.icon} size={16} />{" "}
                  {category.name}
                </Button>
                {canDelete && (
                  <Popconfirm
                    title="Удалить категорию?"
                    description="Эта категория будет удалена. Это действие нельзя отменить."
                    onConfirm={(e) => handleDeleteCategory(category.id, e)}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="Да"
                    cancelText="Нет"
                    placement="top"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      className={styles.deleteCategoryButton}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                )}
              </div>
            );
          })}
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
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          title={type === "planned" ? "Планируемая трата" : "Новая операция"}
          placement="right"
          open={open}
          onClose={handleCancel}
          width={400}
          mask={true}
          footer={
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "16px 24px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <Button style={{ flex: 1, minWidth: 0 }} onClick={handleCancel}>
                Отмена
              </Button>
              <Button
                style={{ flex: 1, minWidth: 0 }}
                type="primary"
                onClick={handleSubmit}
              >
                Добавить
              </Button>
            </div>
          }
        >
          {formContent}
        </Drawer>
      ) : (
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
          width={500}
        >
          {formContent}
        </Modal>
      )}
      <CategoryForm
        open={showCategoryForm}
        onClose={() => setShowCategoryForm(false)}
        transactionType={transactionType}
        onCategoryCreated={handleCategoryCreated}
      />
    </>
  );
};

export default TransactionForm;
