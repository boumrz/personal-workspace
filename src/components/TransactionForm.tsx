import React, { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import * as styles from "./TransactionForm.module.css";

interface TransactionFormProps {
  onClose: () => void;
  type: "actual" | "planned";
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onClose, type }) => {
  const { addTransaction, addPlannedExpense, categories } = useFinance();
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    type === "planned" ? "expense" : "expense"
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(categories[0].id);
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const availableCategories =
    transactionType === "income"
      ? categories.filter((c) => c.name === "Зарплата" || c.name === "Другое")
      : categories;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    const category = categories.find((c) => c.id === selectedCategory);
    if (!category) return;

    const transaction = {
      id: Date.now().toString(),
      type: transactionType,
      amount: parseFloat(amount),
      category,
      description,
      date,
    };

    if (type === "planned") {
      addPlannedExpense(transaction);
    } else {
      addTransaction(transaction);
    }

    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {type === "planned" ? "Планируемая трата" : "Новая операция"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {type === "actual" && (
            <div className={styles.typeSelector}>
              <button
                type="button"
                className={`${styles.typeButton} ${
                  transactionType === "income" ? styles.active : ""
                }`}
                onClick={() => setTransactionType("income")}
              >
                Доход
              </button>
              <button
                type="button"
                className={`${styles.typeButton} ${
                  transactionType === "expense" ? styles.active : ""
                }`}
                onClick={() => setTransactionType("expense")}
              >
                Расход
              </button>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Сумма (₽)</label>
            <input
              type="number"
              className={styles.input}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Категория</label>
            <div className={styles.categoryGrid}>
              {availableCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.categoryButton} ${
                    selectedCategory === category.id ? styles.active : ""
                  }`}
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
                  <span className={styles.categoryIcon}>{category.icon}</span>
                  <span className={styles.categoryName}>{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <input
              type="text"
              className={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите описание"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Дата</label>
            <input
              type="date"
              className={styles.input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton}>
            Добавить
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
