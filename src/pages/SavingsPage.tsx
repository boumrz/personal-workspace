import React, { useState, useEffect, useMemo } from "react";
import { Card, Statistic, FloatButton, Button, Empty } from "antd";
import { PlusOutlined, WalletOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import SavingsList from "../components/SavingsList";
import SavingsForm from "../components/SavingsForm";
import * as styles from "./SavingsPage.module.css";

const SavingsPage: React.FC = () => {
  const { savings, transactions } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Группировка накоплений по месяцам
  const groupedSavings = useMemo(() => {
    const grouped = savings.reduce((groups, saving) => {
      const date = new Date(saving.date);
      const monthKey = date.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      });

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(saving);
      return groups;
    }, {} as Record<string, typeof savings>);

    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(
        grouped[a][0].date.substring(0, 7) + "-01"
      ).getTime();
      const dateB = new Date(
        grouped[b][0].date.substring(0, 7) + "-01"
      ).getTime();
      return dateB - dateA; // Сначала новые месяцы
    });

    return { grouped, sortedMonths };
  }, [savings]);

  // Устанавливаем последний месяц по умолчанию
  useEffect(() => {
    if (groupedSavings.sortedMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(groupedSavings.sortedMonths[0]);
    }
  }, [groupedSavings.sortedMonths, selectedMonth]);

  // Общая сумма накоплений
  const totalSavings = useMemo(() => {
    return savings.reduce((sum, saving) => sum + saving.amount, 0);
  }, [savings]);

  // Общая сумма доходов
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Общая сумма расходов
  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Общий баланс (доходы - расходы)
  const totalBalance = useMemo(() => {
    return totalIncome - totalExpenses;
  }, [totalIncome, totalExpenses]);

  // Средний доход в месяц
  const averageMonthlyIncome = useMemo(() => {
    const incomeTransactions = transactions.filter((t) => t.type === "income");
    if (incomeTransactions.length === 0) return 0;

    // Получаем уникальные месяцы с доходами
    const monthsSet = new Set<string>();
    incomeTransactions.forEach((t) => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthsSet.add(monthKey);
    });

    const monthsCount = monthsSet.size;
    return monthsCount > 0 ? totalIncome / monthsCount : 0;
  }, [transactions, totalIncome]);

  // Процент от дохода
  const savingsPercentage = useMemo(() => {
    if (totalIncome === 0) return 0;
    return (totalSavings / totalIncome) * 100;
  }, [totalSavings, totalIncome]);

  // Накопления за выбранный месяц
  const monthlySavings = useMemo(() => {
    if (!selectedMonth || !groupedSavings.grouped[selectedMonth]) return 0;
    return groupedSavings.grouped[selectedMonth].reduce(
      (sum, saving) => sum + saving.amount,
      0
    );
  }, [selectedMonth, groupedSavings]);

  // Доходы за выбранный месяц
  const monthlyIncome = useMemo(() => {
    if (!selectedMonth) return 0;
    const [monthName, year] = selectedMonth.split(" ");
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
    const yearNum = parseInt(year);

    return transactions
      .filter((t) => {
        const tDate = new Date(t.date);
        return (
          t.type === "income" &&
          tDate.getMonth() === monthIndex &&
          tDate.getFullYear() === yearNum
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonth, transactions]);

  // Процент от дохода за выбранный месяц
  const monthlyPercentage = useMemo(() => {
    if (monthlyIncome === 0) return 0;
    return (monthlySavings / monthlyIncome) * 100;
  }, [monthlySavings, monthlyIncome]);

  return (
    <div className={styles.savingsPage}>
      <div className={styles.content}>
        {/* Статистика */}
        <div className={styles.statsContainer}>
          <Card className={styles.statCard}>
            <Statistic
              title={isMobile ? "Баланс" : "Общий баланс"}
              value={totalBalance}
              precision={isMobile ? 0 : 2}
              suffix="₽"
              styles={{
                content: {
                  color: totalBalance >= 0 ? "#52c41a" : "#ff4d4f",
                  fontSize: "16px",
                },
              }}
            />
          </Card>
          <Card className={styles.statCard}>
            <Statistic
              title={isMobile ? "Средний доход" : "Средний доход в месяц"}
              value={averageMonthlyIncome}
              precision={isMobile ? 0 : 2}
              suffix="₽"
              styles={{
                content: {
                  color: "#1890ff",
                  fontSize: "16px",
                },
              }}
            />
          </Card>
          <Card className={styles.statCard}>
            <Statistic
              title={isMobile ? "Накоплено" : "Всего накоплено"}
              value={totalSavings}
              precision={isMobile ? 0 : 2}
              suffix="₽"
              styles={{
                content: {
                  color: "#52c41a",
                  fontSize: "16px",
                },
              }}
            />
          </Card>
          <Card className={styles.statCard}>
            <Statistic
              title={isMobile ? "% от дохода" : "Процент от дохода"}
              value={savingsPercentage}
              precision={1}
              suffix="%"
              styles={{
                content: {
                  color: "#1890ff",
                  fontSize: "16px",
                },
              }}
            />
          </Card>
          {selectedMonth && (
            <>
              <Card className={styles.statCard}>
                <Statistic
                  title={
                    isMobile
                      ? `За ${selectedMonth.split(" ")[0]}`
                      : `Накоплено за ${selectedMonth}`
                  }
                  value={monthlySavings}
                  precision={isMobile ? 0 : 2}
                  suffix="₽"
                  styles={{
                    content: {
                      color: "#52c41a",
                      fontSize: "16px",
                    },
                  }}
                />
              </Card>
            </>
          )}
        </div>

        {/* Список накоплений */}
        {savings.length === 0 ? (
          <Card className={styles.emptyCard}>
            <Empty description="Нет накоплений" />
          </Card>
        ) : selectedMonth ? (
          <SavingsList
            savings={groupedSavings.grouped[selectedMonth] || []}
            selectedMonth={selectedMonth}
            months={groupedSavings.sortedMonths}
            onMonthChange={setSelectedMonth}
          />
        ) : null}
      </div>

      {/* Кнопка добавления накопления */}
      {isMobile ? (
        <FloatButton
          icon={<PlusOutlined />}
          type="primary"
          onClick={() => setShowForm(true)}
          className={styles.addButtonMobile}
        />
      ) : (
        <div className={styles.addButtonContainer}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setShowForm(true)}
            className={styles.addButtonDesktop}
          >
            Добавить накопление
          </Button>
        </div>
      )}

      {showForm && (
        <SavingsForm open={showForm} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
};

export default SavingsPage;
