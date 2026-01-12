import React from "react";
import { useFinance } from "../context/FinanceContext";
import { Transaction } from "../context/FinanceContext";
import * as styles from "./PlannedExpenses.module.css";

interface PlannedExpensesProps {
  expenses: Transaction[];
}

const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ expenses }) => {
  const { deletePlannedExpense, categories } = useFinance();

  if (expenses.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📅</div>
        <div className={styles.emptyText}>Нет планируемых трат</div>
      </div>
    );
  }

  const totalPlanned = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className={styles.planned}>
      <div className={styles.plannedTotal}>
        <div className={styles.plannedTotalLabel}>Запланировано всего</div>
        <div className={styles.plannedTotalAmount}>
          {totalPlanned.toLocaleString("ru-RU")} ₽
        </div>
      </div>
      <div className={styles.list}>
        {expenses.map((expense) => {
          const category = categories.find(
            (c) => c.id === expense.category.id
          ) || expense.category;

          return (
            <div key={expense.id} className={styles.expense}>
              <div className={styles.expenseLeft}>
                <div
                  className={styles.categoryBadge}
                  style={{ backgroundColor: category.color + "20" }}
                >
                  <span className={styles.categoryIcon}>{category.icon}</span>
                </div>
                <div className={styles.expenseInfo}>
                  <div className={styles.expenseDescription}>
                    {expense.description || "Без описания"}
                  </div>
                  <div className={styles.expenseDetails}>
                    <span className={styles.expenseCategory}>
                      {category.name}
                    </span>
                    <span className={styles.expenseDate}>
                      {new Date(expense.date).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.expenseRight}>
                <div className={styles.expenseAmount}>
                  {expense.amount.toLocaleString("ru-RU")} ₽
                </div>
                <button
                  className={styles.deleteButton}
                  onClick={() => deletePlannedExpense(expense.id)}
                  aria-label="Удалить"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlannedExpenses;
