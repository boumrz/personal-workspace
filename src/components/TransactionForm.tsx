import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

  // Р‘Р°Р·РѕРІС‹Рµ РєР°С‚РµРіРѕСЂРёРё, РєРѕС‚РѕСЂС‹Рµ РЅРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ
  const defaultCategoryNames = [
    "РџСЂРѕРґСѓРєС‚С‹",
    "РўСЂР°РЅСЃРїРѕСЂС‚",
    "Р Р°Р·РІР»РµС‡РµРЅРёСЏ",
    "Р—РґРѕСЂРѕРІСЊРµ",
    "РћРґРµР¶РґР°",
    "Р–РёР»СЊРµ",
    "Р—Р°СЂРїР»Р°С‚Р°",
    "Р”СЂСѓРіРѕРµ",
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
      // Р•СЃР»Рё СѓРґР°Р»РµРЅРЅР°СЏ РєР°С‚РµРіРѕСЂРёСЏ Р±С‹Р»Р° РІС‹Р±СЂР°РЅР°, СЃР±СЂР°СЃС‹РІР°РµРј РІС‹Р±РѕСЂ
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
        "РћС€РёР±РєР° РїСЂРё СѓРґР°Р»РµРЅРёРё РєР°С‚РµРіРѕСЂРёРё";
      alert(errorMessage);
    }
  };

  // РћРїСЂРµРґРµР»СЏРµРј, РјРѕР±РёР»СЊРЅРѕРµ Р»Рё СѓСЃС‚СЂРѕР№СЃС‚РІРѕ
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // РЎР±СЂРѕСЃ РІРІРµРґРµРЅРЅРѕР№ СЃСѓРјРјС‹ РїСЂРё РѕС‚РєСЂС‹С‚РёРё/Р·Р°РєСЂС‹С‚РёРё С„РѕСЂРјС‹
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
        ? categories.filter((c) => c.name === "Р—Р°СЂРїР»Р°С‚Р°" || c.name === "Р”СЂСѓРіРѕРµ")
        : categories,
    [transactionType, categories]
  );

  // Р¤СѓРЅРєС†РёСЏ РґР»СЏ СЂР°СЃС‡РµС‚Р° РѕСЃС‚Р°С‚РєР° Р±СЋРґР¶РµС‚Р° РїРѕ РєР°С‚РµРіРѕСЂРёРё Р·Р° С‚РµРєСѓС‰РёР№ РјРµСЃСЏС†
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

    // РЎСѓРјРјР° Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅС‹С… СЂР°СЃС…РѕРґРѕРІ РґР»СЏ РєР°С‚РµРіРѕСЂРёРё РІ С‚РµРєСѓС‰РµРј РјРµСЃСЏС†Рµ
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

    // РЎСѓРјРјР° С„Р°РєС‚РёС‡РµСЃРєРёС… СЂР°СЃС…РѕРґРѕРІ РґР»СЏ РєР°С‚РµРіРѕСЂРёРё РІ С‚РµРєСѓС‰РµРј РјРµСЃСЏС†Рµ
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

    // РћСЃС‚Р°С‚РѕРє Р±СЋРґР¶РµС‚Р°
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
        amount: initialTransaction.amount,
        description: initialTransaction.description,
        date: dayjs(initialTransaction.date),
        type: initialTransaction.type,
      });
      setTransactionType(initialTransaction.type);
      setSelectedCategory(initialTransaction.category.id);
    } else {
      form.resetFields();
      setTransactionType("expense");
      const firstCat = categories.find((c) => c.name === "РџСЂРѕРґСѓРєС‚С‹" || c.name === "Р”СЂСѓРіРѕРµ") || categories[0];
      setSelectedCategory(firstCat?.id || "");
    }
  }, [open, initialTransaction, categories]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const values = await form.validateFields();
      const category = categories.find((c) => c.id === selectedCategory);
      if (!category) return;

      const transactionData = {
        type: transactionType,
        amount: values.amount,
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

  const isEditMode = !!initialTransaction;
  const handleFormFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.scrollIntoView) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }, []);

  // Р¤СѓРЅРєС†РёСЏ РґР»СЏ Р±Р»РѕРєРёСЂРѕРІРєРё РґР°С‚ РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ С‚РёРїР° РѕРїРµСЂР°С†РёРё
  const disabledDate = (current: dayjs.Dayjs | null) => {
    if (!current) return false;

    if (type === "actual") {
      // Р”Р»СЏ Р°РєС‚СѓР°Р»СЊРЅС‹С… РѕРїРµСЂР°С†РёР№: Р±Р»РѕРєРёСЂСѓРµРј Р±СѓРґСѓС‰РёРµ РјРµСЃСЏС†С‹
      const endOfCurrentMonth = dayjs().endOf("month");
      return current.isAfter(endOfCurrentMonth, "day");
    } else {
      // Р”Р»СЏ РїР»Р°РЅРёСЂСѓРµРјС‹С… С‚СЂР°С‚: Р±Р»РѕРєРёСЂСѓРµРј РїСЂРѕС€Р»С‹Рµ РјРµСЃСЏС†С‹
      const startOfCurrentMonth = dayjs().startOf("month");
      return current.isBefore(startOfCurrentMonth, "day");
    }
  };

  // Р¤СѓРЅРєС†РёСЏ РґР»СЏ РєР°СЃС‚РѕРјРЅРѕРіРѕ СЂРµРЅРґРµСЂРёРЅРіР° РґР°С‚ СЃ С‚СѓР»С‚РёРїР°РјРё
  // Р’Р°Р¶РЅРѕ: РІРѕР·РІСЂР°С‰Р°РµРј РїСЂР°РІРёР»СЊРЅСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ СЃС‚Р°РЅРґР°СЂС‚РЅРѕРіРѕ РїРѕРІРµРґРµРЅРёСЏ Ant Design
  const dateRender = (current: dayjs.Dayjs) => {
    // РџСЂРѕРІРµСЂСЏРµРј, Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅР° Р»Рё РґР°С‚Р°
    const isDisabled = disabledDate(current);

    // РћРїСЂРµРґРµР»СЏРµРј С‚РµРєСЃС‚ РїРѕРґСЃРєР°Р·РєРё РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ С‚РёРїР° РѕРїРµСЂР°С†РёРё
    const tooltipText = type === "actual" 
      ? "РќРµР»СЊР·СЏ РґРѕР±Р°РІР»СЏС‚СЊ РѕРїРµСЂР°С†РёРё РЅР° Р±СѓРґСѓС‰РёРµ РјРµСЃСЏС†С‹"
      : "РќРµР»СЊР·СЏ РїР»Р°РЅРёСЂРѕРІР°С‚СЊ С‚СЂР°С‚С‹ РЅР° РїСЂРѕС€Р»С‹Рµ РјРµСЃСЏС†С‹";

    // Р”Р»СЏ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹С… РґР°С‚ РґРѕР±Р°РІР»СЏРµРј С‚СѓР»С‚РёРї
    const content = isDisabled ? (
      <Tooltip title={tooltipText}>
        <div style={{ width: "100%", height: "100%", cursor: "not-allowed" }}>
          {current.date()}
        </div>
      </Tooltip>
    ) : (
      <div style={{ width: "100%", height: "100%" }}>{current.date()}</div>
    );

    // Р’РѕР·РІСЂР°С‰Р°РµРј СЃРѕРґРµСЂР¶РёРјРѕРµ, РѕР±РµСЂРЅСѓС‚РѕРµ РІ СЃС‚Р°РЅРґР°СЂС‚РЅСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ Ant Design
    // Р­С‚Рѕ СЃРѕС…СЂР°РЅСЏРµС‚ СЃС‚Р°РЅРґР°СЂС‚РЅС‹Рµ РєР»Р°СЃСЃС‹ Рё РїРѕРІРµРґРµРЅРёРµ (РІС‹РґРµР»РµРЅРёРµ С‚РµРєСѓС‰РµРіРѕ РґРЅСЏ, РІС‹Р±СЂР°РЅРЅРѕР№ РґР°С‚С‹ Рё С‚.Рґ.)
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
      onFocusCapture={handleFormFocusCapture}
    >
      {type === "actual" && (
        <Form.Item label="РўРёРї РѕРїРµСЂР°С†РёРё" name="type">
          <Radio.Group
            value={transactionType}
            onChange={(e: any) => {
              setTransactionType(e.target.value);
              setEnteredAmount(null);
              const firstAvailable =
                e.target.value === "income"
                  ? categories.find(
                      (c) => c.name === "Р—Р°СЂРїР»Р°С‚Р°" || c.name === "Р”СЂСѓРіРѕРµ"
                    )
                  : categories[0];
              if (firstAvailable) {
                setSelectedCategory(firstAvailable.id);
              }
            }}
          >
            <Radio value="expense">Р Р°СЃС…РѕРґ</Radio>
            <Radio value="income">Р”РѕС…РѕРґ</Radio>
          </Radio.Group>
        </Form.Item>
      )}

      <Form.Item
        label="РЎСѓРјРјР° (в‚Ѕ)"
        name="amount"
        rules={[
          { required: true, message: "Р’РІРµРґРёС‚Рµ СЃСѓРјРјСѓ" },
          {
            validator: (_, value) => {
              if (value !== null && value !== undefined && value <= 0) {
                return Promise.reject(new Error("РЎСѓРјРјР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ Р±РѕР»СЊС€Рµ 0"));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <InputNumber
          style={{ width: "100%" }}
          min={0.01}
          max={99999999.99}
          step={0.01}
          precision={2}
          placeholder="0"
          controls={false}
          keyboard={false}
          onChange={(value) => setEnteredAmount(value)}
          onKeyDown={(e) => {
            const input = e.target as HTMLInputElement;
            const value = input.value;
            const selectionStart = input.selectionStart || 0;
            const selectionEnd = input.selectionEnd || 0;
            const hasSelection = selectionStart !== selectionEnd;
            
            // РЎР»СѓР¶РµР±РЅС‹Рµ РєР»Р°РІРёС€Рё РІСЃРµРіРґР° СЂР°Р·СЂРµС€РµРЅС‹
            const controlKeys = [
              'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
              'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
              'Home', 'End'
            ];
            if (controlKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
              return;
            }
            
            // Р‘Р»РѕРєРёСЂСѓРµРј РІСЃС‘ РєСЂРѕРјРµ С†РёС„СЂ Рё СЂР°Р·РґРµР»РёС‚РµР»РµР№
            const isNumber = /^[0-9]$/.test(e.key);
            const isDecimalSeparator = e.key === '.' || e.key === ',';
            
            if (!isNumber && !isDecimalSeparator) {
              e.preventDefault();
              return;
            }
            
            // РџСЂРѕРІРµСЂСЏРµРј С‚РѕС‡РєСѓ/Р·Р°РїСЏС‚СѓСЋ вЂ” С‚РѕР»СЊРєРѕ РѕРґРЅР° СЂР°Р·СЂРµС€РµРЅР°
            if (isDecimalSeparator) {
              if (value.includes('.') || value.includes(',')) {
                e.preventDefault();
                return;
              }
              return;
            }
            
            // РџСЂРѕРІРµСЂСЏРµРј РѕРіСЂР°РЅРёС‡РµРЅРёРµ РґР»РёРЅС‹ РґР»СЏ С†РёС„СЂ
            // DECIMAL(10,2): РјР°РєСЃРёРјСѓРј 8 С†РёС„СЂ РґРѕ С‚РѕС‡РєРё, 2 РїРѕСЃР»Рµ
            const normalizedValue = value.replace(',', '.');
            const parts = normalizedValue.split('.');
            const integerPart = parts[0] || '';
            const decimalPart = parts[1] || '';
            
            // РћРїСЂРµРґРµР»СЏРµРј, РєСѓРґР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРІРѕРґРёС‚ (РґРѕ РёР»Рё РїРѕСЃР»Рµ С‚РѕС‡РєРё)
            const dotIndex = value.indexOf('.') !== -1 ? value.indexOf('.') : value.indexOf(',');
            const isBeforeDecimal = dotIndex === -1 || selectionStart <= dotIndex;
            
            if (isBeforeDecimal) {
              // Р’РІРѕРґ РІ С†РµР»СѓСЋ С‡Р°СЃС‚СЊ: РјР°РєСЃРёРјСѓРј 8 С†РёС„СЂ
              if (integerPart.length >= 8 && !hasSelection) {
                e.preventDefault();
              }
            } else {
              // Р’РІРѕРґ РІ РґСЂРѕР±РЅСѓСЋ С‡Р°СЃС‚СЊ: РјР°РєСЃРёРјСѓРј 2 С†РёС„СЂС‹
              if (decimalPart.length >= 2 && !hasSelection) {
                e.preventDefault();
              }
            }
          }}
        />
      </Form.Item>

      {/* РћС‚РѕР±СЂР°Р¶РµРЅРёРµ РѕСЃС‚Р°С‚РєР° Р±СЋРґР¶РµС‚Р° */}
      {type === "actual" && transactionType === "expense" && (
        <Form.Item>
          {calculateBudgetRemaining && calculateBudgetRemaining.planned > 0 ? (
            <Alert
              message={
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    РћСЃС‚Р°С‚РѕРє Р±СЋРґР¶РµС‚Р° РЅР° РјРµСЃСЏС†
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ:{" "}
                    {calculateBudgetRemaining.planned.toLocaleString("ru-RU")} в‚Ѕ
                    {" вЂў "}
                    РџРѕС‚СЂР°С‡РµРЅРѕ:{" "}
                    {calculateBudgetRemaining.spent.toLocaleString("ru-RU")} в‚Ѕ
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
                      ? `РћСЃС‚Р°РЅРµС‚СЃСЏ РїРѕСЃР»Рµ РѕРїРµСЂР°С†РёРё: ${calculateBudgetRemaining.willRemainAfter.toLocaleString(
                          "ru-RU"
                        )} в‚Ѕ`
                      : `РћСЃС‚Р°Р»РѕСЃСЊ: ${calculateBudgetRemaining.remaining.toLocaleString(
                          "ru-RU"
                        )} в‚Ѕ`}
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
                    Р‘СЋРґР¶РµС‚ РЅР° РјРµСЃСЏС†
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    РЎСѓРјРјР° РЅРµ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅР° РґР»СЏ СЌС‚РѕР№ РєР°С‚РµРіРѕСЂРёРё
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    вЂ”
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

      <Form.Item label="РљР°С‚РµРіРѕСЂРёСЏ" required>
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
                        title: "РЈРґР°Р»РёС‚СЊ РєР°С‚РµРіРѕСЂРёСЋ?",
                        content: "Р­С‚Р° РєР°С‚РµРіРѕСЂРёСЏ Р±СѓРґРµС‚ СѓРґР°Р»РµРЅР°. Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµР»СЊР·СЏ РѕС‚РјРµРЅРёС‚СЊ.",
                        okText: "РЈРґР°Р»РёС‚СЊ",
                        okType: "danger",
                        cancelText: "РћС‚РјРµРЅР°",
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
            Р”РѕР±Р°РІРёС‚СЊ РєР°С‚РµРіРѕСЂРёСЋ
          </Button>
        </Space>
      </Form.Item>

      <Form.Item label="РћРїРёСЃР°РЅРёРµ" name="description">
        <Input placeholder="Р’РІРµРґРёС‚Рµ РѕРїРёСЃР°РЅРёРµ" />
      </Form.Item>

      <Form.Item
        label="Р”Р°С‚Р°"
        name="date"
        rules={[
          { required: true, message: "Р’С‹Р±РµСЂРёС‚Рµ РґР°С‚Сѓ" },
          {
            validator: (_, value) => {
              if (!value) {
                return Promise.resolve();
              }

              const selectedDate = dayjs(value);

              if (type === "actual") {
                // Р”Р»СЏ Р°РєС‚СѓР°Р»СЊРЅС‹С… РѕРїРµСЂР°С†РёР№ РїСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РґР°С‚Р° РЅРµ РІ Р±СѓРґСѓС‰РµРј РјРµСЃСЏС†Рµ
                const endOfCurrentMonth = dayjs().endOf("month");
                if (selectedDate.isAfter(endOfCurrentMonth, "day")) {
                  return Promise.reject(
                    new Error("РќРµР»СЊР·СЏ РґРѕР±Р°РІР»СЏС‚СЊ РѕРїРµСЂР°С†РёРё РЅР° Р±СѓРґСѓС‰РёРµ РјРµСЃСЏС†С‹")
                  );
                }
              } else {
                // Р”Р»СЏ РїР»Р°РЅРёСЂСѓРµРјС‹С… С‚СЂР°С‚ РїСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РґР°С‚Р° РЅРµ РІ РїСЂРѕС€Р»РѕРј РјРµСЃСЏС†Рµ
                const startOfCurrentMonth = dayjs().startOf("month");
                if (selectedDate.isBefore(startOfCurrentMonth, "day")) {
                  return Promise.reject(
                    new Error("РќРµР»СЊР·СЏ РїР»Р°РЅРёСЂРѕРІР°С‚СЊ С‚СЂР°С‚С‹ РЅР° РїСЂРѕС€Р»С‹Рµ РјРµСЃСЏС†С‹")
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
          dateRender={dateRender}
        />
      </Form.Item>
    </Form>
  );

  return (
    <>
      {isMobile ? (
        <Drawer
          title={isEditMode ? (type === "planned" ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РїР»Р°РЅ" : "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РѕРїРµСЂР°С†РёСЋ") : (type === "planned" ? "РџР»Р°РЅРёСЂСѓРµРјР°СЏ С‚СЂР°С‚Р°" : "РќРѕРІР°СЏ РѕРїРµСЂР°С†РёСЏ")}
          placement="right"
          className={styles.drawer}
          open={open}
          onClose={handleCancel}
          width="100%"
          mask={true}
          styles={{
            wrapper: { width: "100%", maxWidth: "100vw", height: "100dvh" },
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
                РћС‚РјРµРЅР°
              </Button>
              <Button
                style={{ flex: 1, minWidth: 0 }}
                type="primary"
                onClick={handleSubmit}
              >
                {isEditMode ? "РЎРѕС…СЂР°РЅРёС‚СЊ" : "Р”РѕР±Р°РІРёС‚СЊ"}
              </Button>
            </div>
          }
        >
          {formContent}
        </Drawer>
      ) : (
        <Modal
          title={isEditMode ? (type === "planned" ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РїР»Р°РЅ" : "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РѕРїРµСЂР°С†РёСЋ") : (type === "planned" ? "РџР»Р°РЅРёСЂСѓРµРјР°СЏ С‚СЂР°С‚Р°" : "РќРѕРІР°СЏ РѕРїРµСЂР°С†РёСЏ")}
          open={open}
          onCancel={handleCancel}
          footer={[
            <Button key="cancel" onClick={handleCancel}>
              РћС‚РјРµРЅР°
            </Button>,
            <Button key="submit" type="primary" onClick={handleSubmit}>
                {isEditMode ? "РЎРѕС…СЂР°РЅРёС‚СЊ" : "Р”РѕР±Р°РІРёС‚СЊ"}
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

