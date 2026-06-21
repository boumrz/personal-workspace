import React, { useState, useMemo } from "react";
import { Card, Tabs, FloatButton, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import { useIsMobile } from "../hooks/useIsMobile";
import TransactionList from "./TransactionList";
import PlannedExpenses from "./PlannedExpenses";
import TransactionForm from "./TransactionForm";
import CategoryFilter from "./CategoryFilter";
import * as styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const { transactions, plannedExpenses } = useFinance();
  const [activeTab, setActiveTab] = useState<"actual" | "planned">("actual");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<typeof transactions[0] | null>(null);
  const isMobile = useIsMobile();

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
    () => {
      if (selectedCategories.includes("all")) {
        return transactions;
      }
      return transactions.filter((t) => selectedCategories.includes(t.category.id));
    },
    [transactions, selectedCategories]
  );

  const tabItems = useMemo(
    () => [
      {
        key: "actual",
        label: "Актуальные",
        children: (
            <TransactionList
              transactions={filteredTransactions}
              selectedCategory={selectedCategories.includes("all") ? null : selectedCategories[0] || null}
              plannedExpenses={plannedExpenses}
              onEditTransaction={(t) => {
                setEditingTransaction(t);
              setShowForm(true);
            }}
          />
        ),
      },
      {
        key: "planned",
        label: "Планируемые",
        children: (
          <PlannedExpenses
            expenses={plannedExpenses}
            onEditExpense={(t) => {
              setEditingTransaction(t);
              setActiveTab("planned");
              setShowForm(true);
            }}
          />
        ),
      },
    ],
    [filteredTransactions, selectedCategories, plannedExpenses]
  );

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Мой бюджет - расходы и доходы</h1>
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
          selectedCategories={selectedCategories}
          onSelectCategories={setSelectedCategories}
          open={false}
          onClose={() => undefined}
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
          onClose={() => {
            setShowForm(false);
            setEditingTransaction(null);
          }}
          type={activeTab === "planned" ? "planned" : "actual"}
          initialTransaction={editingTransaction}
        />
      )}
    </div>
  );
};

export default Dashboard;
