import React, { useState, useMemo, useEffect } from "react";
import { Card, Tabs, FloatButton, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import TransactionList from "./TransactionList";
import PlannedExpenses from "./PlannedExpenses";
import TransactionForm from "./TransactionForm";
import CategoryFilter from "./CategoryFilter";
import * as styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const { transactions, plannedExpenses } = useFinance();
  const [activeTab, setActiveTab] = useState<"actual" | "planned">("actual");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Определяем, мобильное ли устройство
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const totalExpenses = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const balance = useMemo(
    () => totalIncome - totalExpenses,
    [totalIncome, totalExpenses]
  );

  const filteredTransactions = useMemo(
    () =>
      selectedCategory
        ? transactions.filter((t) => t.category.id === selectedCategory)
        : transactions,
    [transactions, selectedCategory]
  );

  const tabItems = useMemo(
    () => [
      {
        key: "actual",
        label: "Актуальные",
        children: (
          <TransactionList
            transactions={filteredTransactions}
            selectedCategory={selectedCategory}
            plannedExpenses={plannedExpenses}
          />
        ),
      },
      {
        key: "planned",
        label: "Планируемые",
        children: <PlannedExpenses expenses={plannedExpenses} />,
      },
    ],
    [filteredTransactions, selectedCategory, plannedExpenses]
  );

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Финансовый помощник</h1>
        <Card className={styles.summaryCard} bordered={false}>
          <div className={styles.balanceRow}>
            <span className={styles.balanceLabel}>Баланс</span>
            <span
              className={styles.balanceValue}
              style={{ color: balance >= 0 ? "#fff" : "var(--expense-soft)" }}
            >
              {balance.toLocaleString("ru-RU")} ₽
            </span>
          </div>
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Доходы</span>
              <span className={styles.statValue} style={{ color: "#A5D6A7" }}>
                +{totalIncome.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Расходы</span>
              <span
                className={styles.statValue}
                style={{ color: "var(--expense-soft)" }}
              >
                -{totalExpenses.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </Card>
      </header>

      <div className={styles.content}>
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as "actual" | "planned")}
          items={tabItems}
        />
      </div>

      {/* Кнопка добавления операции */}
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
            Добавить операцию
          </Button>
        </div>
      )}

      {showForm && (
        <TransactionForm
          open={showForm}
          onClose={() => setShowForm(false)}
          type={activeTab === "planned" ? "planned" : "actual"}
        />
      )}
    </div>
  );
};

export default Dashboard;
