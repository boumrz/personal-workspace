import React from "react";
import { useFinance } from "../context/FinanceContext";
import { Transaction } from "../context/FinanceContext";
import * as styles from "./TransactionList.module.css";

interface TransactionListProps {
  transactions: Transaction[];
  selectedCategory: string | null;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  selectedCategory,
}) => {
  const { deleteTransaction, categories } = useFinance();

  const groupedTransactions = transactions.reduce(
    (groups, transaction) => {
      const date = new Date(transaction.date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    },
    {} as Record<string, Transaction[]>
  );

  if (transactions.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📊</div>
        <div className={styles.emptyText}>
          {selectedCategory
            ? "Нет операций в этой категории"
            : "Нет операций"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {Object.entries(groupedTransactions).map(([date, items]) => (
        <div key={date} className={styles.dateGroup}>
          <div className={styles.dateHeader}>{date}</div>
          {items.map((transaction) => {
            const category = categories.find(
              (c) => c.id === transaction.category.id
            ) || transaction.category;

            return (
              <div key={transaction.id} className={styles.transaction}>
                <div className={styles.transactionLeft}>
                  <div
                    className={styles.categoryBadge}
                    style={{ backgroundColor: category.color + "20" }}
                  >
                    <span className={styles.categoryIcon}>{category.icon}</span>
                  </div>
                  <div className={styles.transactionInfo}>
                    <div className={styles.transactionDescription}>
                      {transaction.description || "Без описания"}
                    </div>
                    <div className={styles.transactionCategory}>
                      {category.name}
                    </div>
                  </div>
                </div>
                <div className={styles.transactionRight}>
                  <div
                    className={`${styles.transactionAmount} ${
                      transaction.type === "income"
                        ? styles.income
                        : styles.expense
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {transaction.amount.toLocaleString("ru-RU")} ₽
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => deleteTransaction(transaction.id)}
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TransactionList;
