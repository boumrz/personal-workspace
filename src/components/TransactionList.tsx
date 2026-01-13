import React, { useState, useMemo, useEffect } from "react";
import { List, Card, Empty, Tag, Button } from "antd";
import { DeleteOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import { Transaction } from "../context/FinanceContext";
import IconRenderer from "./IconRenderer";
import * as styles from "./TransactionList.module.css";

interface TransactionListProps {
  transactions: Transaction[];
  selectedCategory: string | null;
  plannedExpenses: Transaction[];
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  selectedCategory,
  plannedExpenses,
}) => {
  const { deleteTransaction, categories } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Группировка по месяцам
  const groupedTransactions = useMemo(() => {
    const grouped = transactions
      .sort((a, b) => {
        // Сортируем по дате (сначала новые)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .reduce((groups, transaction) => {
        const date = new Date(transaction.date);
        const monthKey = date.toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric",
        });

        if (!groups[monthKey]) {
          groups[monthKey] = [];
        }
        groups[monthKey].push(transaction);
        return groups;
      }, {} as Record<string, Transaction[]>);

    // Сортируем месяцы (сначала новые)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(grouped[a][0].date.substring(0, 7) + "-01").getTime();
      const dateB = new Date(grouped[b][0].date.substring(0, 7) + "-01").getTime();
      return dateB - dateA;
    });

    return { grouped, sortedMonths };
  }, [transactions]);

  // Устанавливаем первый месяц по умолчанию
  useEffect(() => {
    if (groupedTransactions.sortedMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(groupedTransactions.sortedMonths[0]);
    }
  }, [groupedTransactions.sortedMonths, selectedMonth]);

  // Функция для получения суммы планируемых расходов по категории за месяц
  const getPlannedAmountForCategory = (
    categoryId: string,
    transactionDate: string
  ): number => {
    const transactionMonth = new Date(transactionDate).getMonth();
    const transactionYear = new Date(transactionDate).getFullYear();

    return plannedExpenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return (
          expense.category.id === categoryId &&
          expenseDate.getMonth() === transactionMonth &&
          expenseDate.getFullYear() === transactionYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  };

  // Функция для получения суммы потраченных средств по категории за месяц
  const getSpentAmountForCategory = (
    categoryId: string,
    transactionDate: string
  ): number => {
    const transactionMonth = new Date(transactionDate).getMonth();
    const transactionYear = new Date(transactionDate).getFullYear();

    return transactions
      .filter((t) => {
        const tDate = new Date(t.date);
        return (
          t.type === "expense" &&
          t.category.id === categoryId &&
          tDate.getMonth() === transactionMonth &&
          tDate.getFullYear() === transactionYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  if (transactions.length === 0) {
    return (
      <Empty
        description={
          selectedCategory
            ? "Нет операций в этой категории"
            : "Нет операций"
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const currentMonthTransactions = groupedTransactions.grouped[selectedMonth] || [];
  const currentMonthIndex = groupedTransactions.sortedMonths.indexOf(selectedMonth);
  const canGoPrev = currentMonthIndex > 0;
  const canGoNext = currentMonthIndex < groupedTransactions.sortedMonths.length - 1;

  const handlePrevMonth = () => {
    if (canGoPrev) {
      setSelectedMonth(groupedTransactions.sortedMonths[currentMonthIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setSelectedMonth(groupedTransactions.sortedMonths[currentMonthIndex + 1]);
    }
  };

  return (
    <div className={styles.list}>
      <div className={styles.monthSelector}>
        <Button
          icon={<LeftOutlined />}
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className={styles.monthButton}
        />
        <div className={styles.monthLabel}>
          {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)}
        </div>
        <Button
          icon={<RightOutlined />}
          onClick={handleNextMonth}
          disabled={!canGoNext}
          className={styles.monthButton}
        />
      </div>
      {currentMonthTransactions.length === 0 ? (
        <Empty
          description={
            selectedCategory
              ? "Нет операций в этой категории за выбранный месяц"
              : "Нет операций за выбранный месяц"
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={currentMonthTransactions}
          renderItem={(transaction) => {
            const category = categories.find(
              (c) => c.id === transaction.category.id
            ) || transaction.category;

            // Получаем планируемую сумму и потраченную сумму для расхода
            const plannedAmount =
              transaction.type === "expense"
                ? getPlannedAmountForCategory(
                    transaction.category.id,
                    transaction.date
                  )
                : 0;
            const spentAmount =
              transaction.type === "expense"
                ? getSpentAmountForCategory(
                    transaction.category.id,
                    transaction.date
                  )
                : 0;

            return (
              <List.Item className={styles.listItem}>
                <Card className={styles.transaction} bordered={false}>
                  <div className={styles.transactionLeft}>
                    <div
                      className={styles.categoryBadge}
                      style={{ backgroundColor: category.color + "20" }}
                    >
                      <span className={styles.categoryIcon}>
                        <IconRenderer iconName={category.icon} size={24} color={category.color} />
                      </span>
                    </div>
                    <div className={styles.transactionInfo}>
                      <div className={styles.transactionDescription}>
                        {transaction.description || "Без описания"}
                      </div>
                      <div className={styles.transactionMeta}>
                        <Tag color={category.color}>{category.name}</Tag>
                        {transaction.type === "expense" &&
                          plannedAmount > 0 && (
                            <span className={styles.plannedProgress}>
                              {spentAmount.toLocaleString("ru-RU")}/
                              {plannedAmount.toLocaleString("ru-RU")} ₽
                            </span>
                          )}
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
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => deleteTransaction(transaction.id)}
                      className={styles.deleteButton}
                    />
                  </div>
                </Card>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};

export default TransactionList;
