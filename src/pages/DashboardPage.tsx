import React, { useMemo } from "react";
import { Card, Row, Col, Statistic } from "antd";
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
      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Баланс"
              value={balance}
              precision={0}
              valueStyle={{
                color: balance >= 0 ? "#66BB6A" : "#FF7043",
                fontSize: "28px",
                fontWeight: 700,
              }}
              suffix="₽"
              formatter={(value) => value?.toLocaleString("ru-RU")}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Доходы"
              value={totalIncome}
              precision={0}
              valueStyle={{
                color: "#66BB6A",
                fontSize: "24px",
                fontWeight: 600,
              }}
              suffix="₽"
              formatter={(value) => value?.toLocaleString("ru-RU")}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Расходы"
              value={totalExpenses}
              precision={0}
              valueStyle={{
                color: "#FF7043",
                fontSize: "24px",
                fontWeight: 600,
              }}
              suffix="₽"
              formatter={(value) => value?.toLocaleString("ru-RU")}
            />
          </Card>
        </Col>
      </Row>

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
