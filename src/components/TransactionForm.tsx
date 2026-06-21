import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Modal,
  Drawer,
  Form,
  Input,
  Radio,
  Button,
  DatePicker,
  Space,
  Alert,
  App,
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
  initialTransaction?: { id: string; type: "income" | "expense"; amount: number; category: { id: string }; description: string; date: string } | null;
}

const AMOUNT_MAX = 99999999.99;

function normalizeAmountInput(raw: string): string {
  const withDot = raw.replace(/,/g, ".");
  const compact = withDot.replace(/\s+/g, "");
  return compact.replace(/[^0-9+.]/g, "");
}

function parseAmountInput(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().replace(",", ".");
  if (!normalized) return null;
  if (normalized.endsWith("+")) return null;

  const parts = normalized.split("+");
  if (parts.length === 0) return null;

  let total = 0;
  for (const part of parts) {
    if (!part || !/^\d+(\.\d{1,2})?$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (!Number.isFinite(value)) return null;
    total += value;
  }

  const rounded = Math.round(total * 100) / 100;
  if (rounded <= 0 || rounded > AMOUNT_MAX) return null;
  return rounded;
}

function hasAdditionExpression(raw: string): boolean {
  return raw.includes("+");
}

function getAmountExpressionHint(raw: string, parsedAmount: number | null): string | null {
  const normalized = normalizeAmountInput(raw);
  if (!normalized || !hasAdditionExpression(normalized)) {
    return null;
  }
  if (parsedAmount === null) {
    return "Завершите выражение в калькуляторе";
  }
  return `Итого: ${formatAmountForDisplay(parsedAmount)} ₽`;
}

function formatAmountForInput(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatAmountForDisplay(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type CategoryScope = "income" | "expense" | "both";

function resolveCategoryScope(category: { name: string; type?: CategoryScope }): CategoryScope {
  if (category.type === "income" || category.type === "expense" || category.type === "both") {
    return category.type;
  }
  if (category.name === "Зарплата") return "income";
  if (category.name === "Другое") return "both";
  return "expense";
}

function isCategoryAvailableForType(
  category: { name: string; type?: CategoryScope },
  transactionType: "income" | "expense"
) {
  const scope = resolveCategoryScope(category);
  return scope === "both" || scope === transactionType;
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  open,
  onClose,
  type,
  initialTransaction = null,
}) => {
  const { modal } = App.useApp();
  const {
    addTransaction,
    addPlannedExpense,
    updateTransaction,
    updatePlannedExpense,
    categories,
    deleteCategory,
    transactions,
    plannedExpenses,
  } = useFinance();
  const [form] = Form.useForm();
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "expense"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState<number | null>(null);
  const [amountInputValue, setAmountInputValue] = useState("");

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

  const handleDeleteCategory = async (
    categoryId: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await deleteCategory(categoryId);
      // Если удаленная категория была выбрана, сбрасываем выбор
      if (selectedCategory === categoryId) {
        const remainingCategories = availableCategories.filter(
          (c) => c.id !== categoryId
        );
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

  // Сброс состояния суммы при закрытии формы
  useEffect(() => {
    if (!open) {
      setEnteredAmount(null);
      setAmountInputValue("");
    }
  }, [open]);

  const applyAmountInputValue = useCallback(
    (raw: string) => {
      const normalized = normalizeAmountInput(raw);
      const parsed = parseAmountInput(normalized);

      setAmountInputValue(normalized);
      setEnteredAmount(parsed);
      form.setFieldValue("amount", normalized);
    },
    [form]
  );

  const amountExpressionHint = useMemo(
    () => getAmountExpressionHint(amountInputValue, enteredAmount),
    [amountInputValue, enteredAmount]
  );

  const handleCategoryCreated = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowCategoryForm(false);
  };

  const availableCategories = useMemo(
    () =>
      categories.filter((category) =>
        isCategoryAvailableForType(category, type === "planned" ? "expense" : transactionType)
      ),
    [type, transactionType, categories]
  );

  // Функция для расчета остатка бюджета по категории за текущий месяц
  const calculateBudgetRemaining = useMemo(() => {
    if (
      type !== "actual" ||
      transactionType !== "expense" ||
      !selectedCategory
    ) {
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
  }, [
    type,
    transactionType,
    selectedCategory,
    plannedExpenses,
    transactions,
    enteredAmount,
  ]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(
        availableCategories[0]?.id || categories[0]?.id || ""
      );
    }
  }, [categories, availableCategories, selectedCategory]);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;

    if (!justOpened) return;

    if (initialTransaction) {
      form.setFieldsValue({
        amount: formatAmountForInput(initialTransaction.amount),
        description: initialTransaction.description,
        date: dayjs(initialTransaction.date),
        type: initialTransaction.type,
      });
      setTransactionType(initialTransaction.type);
      setSelectedCategory(initialTransaction.category.id);
      setAmountInputValue(formatAmountForInput(initialTransaction.amount));
      setEnteredAmount(initialTransaction.amount);
    } else {
      form.resetFields();
      setTransactionType("expense");
      const firstCat =
        categories.find((c) => c.name === "Продукты" && isCategoryAvailableForType(c, "expense")) ||
        categories.find((c) => isCategoryAvailableForType(c, "expense")) ||
        categories[0];
      setSelectedCategory(firstCat?.id || "");
      setAmountInputValue("");
      setEnteredAmount(null);
    }
  }, [open, initialTransaction, categories, form]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const values = await form.validateFields();
      const category = categories.find((c) => c.id === selectedCategory);
      if (!category) return;
      const amount = parseAmountInput(values.amount);
      if (amount === null || amount <= 0) {
        form.setFields([
          { name: "amount", errors: ["Введите сумму больше 0"] },
        ]);
        return;
      }

      const transactionData = {
        type: transactionType,
        amount,
        category,
        description: values.description || "",
        date: values.date.format("YYYY-MM-DD"),
      };

      if (initialTransaction) {
        if (type === "planned") {
          await updatePlannedExpense(initialTransaction.id, transactionData);
        } else {
          await updateTransaction(initialTransaction.id, transactionData);
        }
      } else {
        if (type === "planned") {
          await addPlannedExpense(transactionData);
        } else {
          await addTransaction(transactionData);
        }
      }

      form.resetFields();
      setEnteredAmount(null);
      setAmountInputValue("");
      onClose();
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setEnteredAmount(null);
    setAmountInputValue("");
    onClose();
  };

  const isEditMode = !!initialTransaction;
  const handleFormFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const scrollContainer = target?.closest(".ant-drawer-body") as HTMLElement | null;
    if (!target || !scrollContainer) return;

    window.setTimeout(() => {
      const targetRect = target.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const overflowTop = targetRect.top - containerRect.top;
      const overflowBottom = targetRect.bottom - containerRect.bottom;

      if (overflowTop < 16) {
        scrollContainer.scrollBy({ top: overflowTop - 16, behavior: "smooth" });
      } else if (overflowBottom > -16) {
        scrollContainer.scrollBy({ top: overflowBottom + 16, behavior: "smooth" });
      }
    }, 120);
  }, []);

  // Функция для блокировки дат в зависимости от типа операции
  const disabledDate = (current: dayjs.Dayjs | null) => {
    if (!current) return false;

    if (type === "actual") {
      // Для актуальных операций: блокируем будущие месяцы
      const endOfCurrentMonth = dayjs().endOf("month");
      return current.isAfter(endOfCurrentMonth, "day");
    } else {
      // Для планируемых трат: блокируем прошлые месяцы
      const startOfCurrentMonth = dayjs().startOf("month");
      return current.isBefore(startOfCurrentMonth, "day");
    }
  };

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ date: dayjs(), type: "expense" }}
      onFocusCapture={handleFormFocusCapture}
    >
      {type === "actual" && (
        <Form.Item label="Тип операции" name="type">
          <Radio.Group
            value={transactionType}
            onChange={(e: any) => {
              const nextType = e.target.value as "income" | "expense";
              setTransactionType(nextType);
              setEnteredAmount(null);
              const firstAvailable = categories.find((category) =>
                isCategoryAvailableForType(category, nextType)
              );
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
        className={styles.amountField}
        label="Сумма (₽)"
        name="amount"
        extra="В поле суммы есть калькулятор"
        rules={[
          { required: true, message: "Введите сумму" },
          {
            validator: (_, value) => {
              const parsed = parseAmountInput(value);
              if (parsed === null) {
                return Promise.reject(new Error("Введите корректную сумму или выражение"));
              }
              if (parsed <= 0) {
                return Promise.reject(new Error("Введите сумму больше 0"));
              }
              if (parsed > AMOUNT_MAX) {
                return Promise.reject(
                  new Error("Сумма не может превышать 99 999 999.99")
                );
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input
          style={{ width: "100%" }}
          type="text"
          inputMode="text"
          placeholder="0.00"
          value={amountInputValue}
          onChange={(event) => applyAmountInputValue(event.target.value)}
          onKeyDown={(event) => {
            const controlKeys = [
              "Backspace",
              "Delete",
              "Tab",
              "Escape",
              "Enter",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ];

            if (controlKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
              return;
            }

            if (!/^[0-9+.,]$/.test(event.key)) {
              event.preventDefault();
            }
          }}
        />
      </Form.Item>

      {amountExpressionHint ? (
        <Form.Item style={{ marginTop: -10 }}>
          <div className={styles.amountSaveHint}>{amountExpressionHint}</div>
        </Form.Item>
      ) : null}

      {/* Отображение остатка бюджета */}
      {type === "actual" && transactionType === "expense" && (
        <Form.Item>
          {calculateBudgetRemaining && calculateBudgetRemaining.planned > 0 ? (
            <Alert
              message={
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    Остаток бюджета на месяц
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Запланировано:{" "}
                    {calculateBudgetRemaining.planned.toLocaleString("ru-RU")} ₽
                    {" • "}
                    Потрачено:{" "}
                    {calculateBudgetRemaining.spent.toLocaleString("ru-RU")} ₽
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
                      ? `Останется после операции: ${calculateBudgetRemaining.willRemainAfter.toLocaleString(
                          "ru-RU"
                        )} ₽`
                      : `Осталось: ${calculateBudgetRemaining.remaining.toLocaleString(
                          "ru-RU"
                        )} ₽`}
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
          ) : (
            <Alert
              message={
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    Бюджет на месяц
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Сумма не запланирована для этой категории
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    —
                  </div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
        </Form.Item>
      )}

      <Form.Item label="Категория" required>
        <Space wrap size={8} className={styles.categoriesContainer}>
          {availableCategories.map((category) => {
            const canDelete = !isDefaultCategory(category.name);
            return (
              <div key={category.id} className={styles.categoryWrapper}>
                <Button
                  size="small"
                  type={
                    selectedCategory === category.id ? "primary" : "default"
                  }
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
                  <IconRenderer iconName={category.icon} size={12} />{" "}
                  {category.name}
                </Button>
                {canDelete && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    className={styles.deleteCategoryButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      modal.confirm({
                        title: "Удалить категорию?",
                        content: "Эта категория будет удалена. Это действие нельзя отменить.",
                        okText: "Удалить",
                        okType: "danger",
                        cancelText: "Отмена",
                        onOk: () => handleDeleteCategory(category.id),
                      });
                    }}
                  />
                )}
              </div>
            );
          })}
          <Button
            size="small"
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
        label={type === "actual" ? "Дата операции" : "Дата плановой траты"}
        name="date"
        extra={
          type === "actual"
            ? "Можно выбрать дату до конца текущего месяца"
            : "Можно выбрать дату начиная с текущего месяца"
        }
        rules={[
          { required: true, message: "Выберите дату" },
          {
            validator: (_, value) => {
              if (!value) {
                return Promise.resolve();
              }

              const selectedDate = dayjs(value);

              if (type === "actual") {
                // Для актуальных операций проверяем, что дата не в будущем месяце
                const endOfCurrentMonth = dayjs().endOf("month");
                if (selectedDate.isAfter(endOfCurrentMonth, "day")) {
                  return Promise.reject(
                    new Error("Нельзя добавлять операции на будущие месяцы")
                  );
                }
              } else {
                // Для планируемых трат проверяем, что дата не в прошлом месяце
                const startOfCurrentMonth = dayjs().startOf("month");
                if (selectedDate.isBefore(startOfCurrentMonth, "day")) {
                  return Promise.reject(
                    new Error("Нельзя планировать траты на прошлые месяцы")
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
        />
      </Form.Item>

      {type === "actual" && (
        <Form.Item>
          <Space wrap size={8}>
            <Button size="small" onClick={() => form.setFieldValue("date", dayjs())}>
              Сегодня
            </Button>
            <Button
              size="small"
              onClick={() => form.setFieldValue("date", dayjs().subtract(1, "day"))}
            >
              Вчера
            </Button>
          </Space>
        </Form.Item>
      )}
    </Form>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          title={isEditMode ? (type === "planned" ? "Редактировать план" : "Редактировать операцию") : (type === "planned" ? "Планируемая трата" : "Новая операция")}
          placement="right"
          className={styles.drawer}
          open={open}
          onClose={handleCancel}
          width="100%"
          mask={true}
          styles={{
            wrapper: { width: "100%", maxWidth: "100vw", height: "100vh" },
            body: {
              overflowY: "auto",
              paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
            },
          }}
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
                {isEditMode ? "Сохранить" : "Добавить"}
              </Button>
            </div>
          }
        >
          {formContent}
        </Drawer>
      ) : (
        <Modal
          title={isEditMode ? (type === "planned" ? "Редактировать план" : "Редактировать операцию") : (type === "planned" ? "Планируемая трата" : "Новая операция")}
          open={open}
          onCancel={handleCancel}
          footer={[
            <Button key="cancel" onClick={handleCancel}>
              Отмена
            </Button>,
            <Button key="submit" type="primary" onClick={handleSubmit}>
                {isEditMode ? "Сохранить" : "Добавить"}
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
        transactionType={type === "planned" ? "expense" : transactionType}
        onCategoryCreated={handleCategoryCreated}
      />
    </>
  );
};

export default TransactionForm;

