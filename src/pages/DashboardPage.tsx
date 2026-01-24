import React, { useMemo, useState } from "react";
import {
  LeftOutlined,
  RightOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
} from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import WeeklyBarChart from "../components/charts/WeeklyBarChart";
import BalanceHistoryChart from "../components/charts/BalanceHistoryChart";
import ExpensesByCategoryChart from "../components/charts/ExpensesByCategoryChart";
import PageHeader from "../components/PageHeader";
import * as styles from "./DashboardPage.module.css";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/ru";

dayjs.extend(isoWeek);
dayjs.locale("ru");

const DashboardPage: React.FC = () => {
  const { transactions } = useFinance();
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [chartType, setChartType] = useState<"expense" | "income">("expense");

  // Фильтруем транзакции по текущему месяцу
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const transactionDate = dayjs(t.date);
      return (
        transactionDate.month() === currentMonth.month() &&
        transactionDate.year() === currentMonth.year()
      );
    });
  }, [transactions, currentMonth]);

  // Рассчитываем итоговые суммы за месяц
  const { totalIncome, totalExpenses, balance } = useMemo(() => {
    const income = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses,
    };
  }, [monthTransactions]);

  // Данные для Balance Trend
  const balanceTrendData = useMemo(() => {
    const sortedTransactions = [...monthTransactions].sort(
      (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    );

    // Считаем начальный баланс (все транзакции до текущего месяца)
    const beforeMonthTransactions = transactions.filter((t) => {
      const transactionDate = dayjs(t.date);
      return transactionDate.isBefore(currentMonth.startOf("month"));
    });

    let startingBalance = beforeMonthTransactions.reduce((sum, t) => {
      return t.type === "income" ? sum + t.amount : sum - t.amount;
    }, 0);

    const history: Array<{ date: string; balance: number }> = [];
    let runningBalance = startingBalance;

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

    const endingBalance =
      history.length > 0 ? history[history.length - 1].balance : startingBalance;

    return {
      history,
      startingBalance,
      endingBalance,
      change: endingBalance - startingBalance,
    };
  }, [monthTransactions, transactions, currentMonth]);

  // Получаем количество недель в месяце
  const weeksInMonth = useMemo(() => {
    const startOfMonth = currentMonth.startOf("month");
    const endOfMonth = currentMonth.endOf("month");
    const firstWeek = startOfMonth.isoWeek();
    const lastWeek = endOfMonth.isoWeek();

    if (lastWeek < firstWeek) {
      return 5;
    }
    return Math.min(lastWeek - firstWeek + 1, 5);
  }, [currentMonth]);

  // Данные по неделям
  const weeklyData = useMemo(() => {
    const weeks: Array<{
      week: number;
      income: number;
      expense: number;
      startDate: dayjs.Dayjs;
      endDate: dayjs.Dayjs;
    }> = [];
    const startOfMonth = currentMonth.startOf("month");

    for (let i = 0; i < weeksInMonth; i++) {
      const weekStart = startOfMonth.add(i * 7, "day").startOf("isoWeek");
      const weekEnd = weekStart.endOf("isoWeek");

      const weekTransactions = monthTransactions.filter((t) => {
        const date = dayjs(t.date);
        return (
          date.isAfter(weekStart.subtract(1, "day")) &&
          date.isBefore(weekEnd.add(1, "day"))
        );
      });

      const income = weekTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = weekTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      weeks.push({
        week: i + 1,
        income,
        expense,
        startDate: weekStart,
        endDate: weekEnd,
      });
    }

    return weeks;
  }, [monthTransactions, currentMonth, weeksInMonth]);

  // Данные выбранной недели
  const selectedWeekData = useMemo(() => {
    return (
      weeklyData.find((w) => w.week === selectedWeek) || {
        week: selectedWeek,
        income: 0,
        expense: 0,
        startDate: currentMonth.startOf("month"),
        endDate: currentMonth.startOf("month").add(6, "day"),
      }
    );
  }, [weeklyData, selectedWeek, currentMonth]);

  // Данные для круговой диаграммы по категориям
  const categoryData = useMemo(() => {
    const filteredTransactions = monthTransactions.filter(
      (t) => t.type === chartType
    );
    const categoryMap = new Map<string, number>();

    filteredTransactions.forEach((transaction) => {
      const categoryId = transaction.category.id;
      const current = categoryMap.get(categoryId) || 0;
      categoryMap.set(categoryId, current + transaction.amount);
    });

    return Array.from(categoryMap.entries()).map(([categoryId, amount]) => {
      const category = monthTransactions.find(
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
  }, [monthTransactions, chartType]);

  const categoryTotal = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryData]);

  // Навигация по месяцам
  const goToPrevMonth = () => {
    setCurrentMonth((prev) => prev.subtract(1, "month"));
    setSelectedWeek(1);
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => prev.add(1, "month"));
    setSelectedWeek(1);
  };

  // Форматирование названия месяца
  const monthName = useMemo(() => {
    const isCurrentMonth =
      currentMonth.month() === dayjs().month() &&
      currentMonth.year() === dayjs().year();
    if (isCurrentMonth) {
      return "Этот месяц";
    }
    return currentMonth.format("MMMM YYYY");
  }, [currentMonth]);

  return (
    <div className={styles.dashboardPage}>
      <PageHeader title="Отчёт" />
      <div className={styles.container}>
        {/* Селектор периода */}
        <div className={styles.periodSelector}>
          <span className={styles.periodLabel}>{monthName}</span>
          <div className={styles.periodNav}>
            <button className={styles.navBtn} onClick={goToPrevMonth}>
              <LeftOutlined />
            </button>
            <button className={styles.navBtn} onClick={goToNextMonth}>
              <RightOutlined />
            </button>
          </div>
        </div>

        {/* Статистика доходов/расходов */}
        <div className={styles.summaryStats}>
          <div className={styles.statBox}>
            <span className={styles.statBoxValue}>
              ₽{totalIncome.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statBoxValue}>
              ₽{totalExpenses.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Balance Trend */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Динамика баланса</span>
            <div className={styles.chartBalance}>
              {balanceTrendData.change >= 0 ? (
                <CaretUpOutlined className={styles.balanceIconUp} />
              ) : (
                <CaretDownOutlined className={styles.balanceIconDown} />
              )}
              <span
                className={
                  balanceTrendData.change >= 0
                    ? styles.balancePositive
                    : styles.balanceNegative
                }
              >
                {balanceTrendData.change >= 0 ? "" : "-"}₽
                {Math.abs(balanceTrendData.change).toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className={styles.balanceStats}>
            <div className={styles.balanceStat}>
              <span className={styles.balanceStatLabel}>Начальный баланс</span>
              <span className={styles.balanceStatValue}>
                ₽
                {balanceTrendData.startingBalance.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={styles.balanceStat}>
              <span className={styles.balanceStatLabel}>Конечный баланс</span>
              <span className={styles.balanceStatValue}>
                {balanceTrendData.endingBalance < 0 ? "-" : ""}₽
                {Math.abs(balanceTrendData.endingBalance).toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className={styles.trendChartContainer}>
            <BalanceHistoryChart data={balanceTrendData.history} />
          </div>
        </div>

        {/* Категории с переключателем */}
        <div className={styles.chartCard}>
          <div className={styles.typeToggle}>
            <button
              className={`${styles.toggleBtn} ${
                chartType === "expense" ? styles.toggleBtnActive : ""
              }`}
              onClick={() => setChartType("expense")}
            >
              Расходы
            </button>
            <button
              className={`${styles.toggleBtn} ${
                chartType === "income" ? styles.toggleBtnActive : ""
              }`}
              onClick={() => setChartType("income")}
            >
              Доходы
            </button>
          </div>

          <div className={styles.donutChartContainer}>
            {categoryData.length > 0 ? (
              <>
                <ExpensesByCategoryChart data={categoryData} />
                <div className={styles.donutCenter}>
                  <span className={styles.donutCenterLabel}>Все категории</span>
                  <span className={styles.donutCenterValue}>
                    ₽{categoryTotal.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            ) : (
              <div className={styles.emptyChart}>
                Нет данных за этот период
              </div>
            )}
          </div>
        </div>

        {/* Недельная статистика */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>По неделям</span>
          </div>

          <div className={styles.weeklyChartContainer}>
            <WeeklyBarChart
              data={weeklyData}
              selectedWeek={selectedWeek}
              onWeekSelect={setSelectedWeek}
            />
          </div>

          {/* Статистика выбранной недели */}
          <div className={styles.weekStats}>
            <div className={styles.weekStatBox}>
              <span className={styles.weekStatLabel}>
                Неделя {selectedWeek} — Доходы
              </span>
              <span className={styles.weekStatValue}>
                ₽
                {selectedWeekData.income.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={styles.weekStatBox}>
              <span className={styles.weekStatLabel}>
                Неделя {selectedWeek} — Расходы
              </span>
              <span className={styles.weekStatValue}>
                ₽
                {selectedWeekData.expense.toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
