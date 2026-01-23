import React, { useMemo } from "react";
import { Card, Row, Col } from "antd";
import { useFinance } from "../context/FinanceContext";
import ExpensesByCategoryChart from "../components/charts/ExpensesByCategoryChart";
import BalanceHistoryChart from "../components/charts/BalanceHistoryChart";
import PageHeader from "../components/PageHeader";
import * as styles from "./DashboardPage.module.css";
import dayjs from "dayjs";

const DashboardPage: React.FC = () => {
  const { transactions } = useFinance();

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const balance = totalIncome - totalExpenses;

  // Данные для графика расходов по категориям
  const expensesByCategory = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const categoryMap = new Map<string, number>();

    expenses.forEach((transaction) => {
      const categoryId = transaction.category.id;
      const current = categoryMap.get(categoryId) || 0;
      categoryMap.set(categoryId, current + transaction.amount);
    });

    return Array.from(categoryMap.entries()).map(([categoryId, amount]) => {
      const category = transactions.find(
        (t) => t.category.id === categoryId
      )?.category;
      return {
        categoryId,
        categoryName: category?.name || "Неизвестно",
        amount,
        color: category?.color || "#90A4AE",
        icon: category?.icon || "Package",
      };
    });
  }, [transactions]);

  // Данные для графика динамики баланса
  const balanceHistory = useMemo(() => {
    const sortedTransactions = [...transactions].sort(
      (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    );

    let runningBalance = 0;
    const history: Array<{ date: string; balance: number }> = [];

    sortedTransactions.forEach((transaction) => {
      if (transaction.type === "income") {
        runningBalance += transaction.amount;
      } else {
        runningBalance -= transaction.amount;
      }
      history.push({
        date: transaction.date,
        balance: runningBalance,
      });
    });

    return history;
  }, [transactions]);

  return (
    <div className={styles.dashboardPage}>
      <PageHeader title="Дашборд" />
      {/* Статистика */}
      <div className={styles.statsRow}>
        <Card className={styles.summaryCard}>
          <div className={styles.balanceRow}>
            <span className={styles.balanceLabel}>Баланс</span>
            <span
              className={styles.balanceValue}
              style={{
                color: balance >= 0 ? "var(--income)" : "var(--expense)",
              }}
            >
              {balance.toLocaleString("ru-RU")} ₽
            </span>
          </div>
          <div className={styles.statsItems}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Доходы</span>
              <span
                className={styles.statValue}
                style={{ color: "var(--income)" }}
              >
                +{totalIncome.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Расходы</span>
              <span
                className={styles.statValue}
                style={{ color: "var(--expense)" }}
              >
                -{totalExpenses.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Графики */}
      <Row gutter={[16, 16]} className={styles.chartsRow}>
        <Col xs={24} lg={12}>
          <Card title="Расходы по категориям" className={styles.chartCard}>
            <ExpensesByCategoryChart data={expensesByCategory} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Динамика баланса" className={styles.chartCard}>
            <BalanceHistoryChart data={balanceHistory} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
