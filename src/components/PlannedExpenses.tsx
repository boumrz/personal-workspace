import React, { useState, useMemo, useEffect } from "react";
import { List, Card, Empty, Tag, Button, Statistic } from "antd";
import { DeleteOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import { Transaction } from "../context/FinanceContext";
import IconRenderer from "./IconRenderer";
import * as styles from "./PlannedExpenses.module.css";

interface PlannedExpensesProps {
  expenses: Transaction[];
}

const PlannedExpenses: React.FC<PlannedExpensesProps> = ({ expenses }) => {
  const { deletePlannedExpense, categories } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Группировка по месяцам
  const expensesByMonth = useMemo(() => {
    const grouped = expenses.reduce((groups, expense) => {
      const date = new Date(expense.date);
      const monthKey = date.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      });

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(expense);
      return groups;
    }, {} as Record<string, Transaction[]>);

    // Сортируем транзакции внутри каждого месяца (сначала старые)
    Object.keys(grouped).forEach((monthKey) => {
      grouped[monthKey].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    });

    // Сортируем месяцы (сначала старые)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(
        grouped[a][0].date.substring(0, 7) + "-01"
      ).getTime();
      const dateB = new Date(
        grouped[b][0].date.substring(0, 7) + "-01"
      ).getTime();
      return dateA - dateB;
    });

    return { grouped, sortedMonths };
  }, [expenses]);

  // Устанавливаем последний месяц по умолчанию (самый новый)
  useEffect(() => {
    if (expensesByMonth.sortedMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(expensesByMonth.sortedMonths[expensesByMonth.sortedMonths.length - 1]);
    }
  }, [expensesByMonth.sortedMonths, selectedMonth]);

  if (expenses.length === 0) {
    return (
      <Empty
        description="Нет планируемых трат"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const currentMonthExpenses =
    expensesByMonth.grouped[selectedMonth] || [];
  const totalPlanned = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const currentMonthIndex = expensesByMonth.sortedMonths.indexOf(selectedMonth);
  const canGoPrev = currentMonthIndex > 0;
  const canGoNext = currentMonthIndex < expensesByMonth.sortedMonths.length - 1;

  const handlePrevMonth = () => {
    if (canGoPrev) {
      setSelectedMonth(expensesByMonth.sortedMonths[currentMonthIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setSelectedMonth(expensesByMonth.sortedMonths[currentMonthIndex + 1]);
    }
  };

  return (
    <div className={styles.planned}>
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
      <Card className={styles.plannedTotal} bordered={false}>
        <Statistic
          title={`Запланировано за ${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)}`}
          value={totalPlanned}
          precision={0}
          suffix="₽"
          formatter={(value) => value?.toLocaleString("ru-RU")}
        />
      </Card>
      <List
        dataSource={currentMonthExpenses}
        renderItem={(expense) => {
          const category = categories.find(
            (c) => c.id === expense.category.id
          ) || expense.category;

          return (
            <List.Item className={styles.listItem}>
              <Card className={styles.expense} bordered={false}>
                <div className={styles.expenseLeft}>
                  <div
                    className={styles.categoryBadge}
                    style={{ backgroundColor: category.color + "20" }}
                  >
                    <span className={styles.categoryIcon}>
                      <IconRenderer iconName={category.icon} size={24} color={category.color} />
                    </span>
                  </div>
                  <div className={styles.expenseInfo}>
                    <div className={styles.expenseDescription}>
                      {expense.description || "Без описания"}
                    </div>
                    <div className={styles.expenseDetails}>
                      <Tag color={category.color}>{category.name}</Tag>
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
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deletePlannedExpense(expense.id)}
                    className={styles.deleteButton}
                  />
                </div>
              </Card>
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default PlannedExpenses;
