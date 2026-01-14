import React, { useState, useMemo } from "react";
import { Card, Statistic, Tabs, FloatButton } from "antd";
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

  const totalIncome = useMemo(
    () => transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const totalExpenses = useMemo(
    () => transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const balance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

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
        <Card className={styles.balanceCard} bordered={false}>
          <Statistic
            title="Баланс"
            value={balance}
            precision={0}
            valueStyle={{
              color: balance >= 0 ? "#fff" : "#FFAB91",
              fontSize: "32px",
              fontWeight: 700,
            }}
            suffix="₽"
            formatter={(value) => value?.toLocaleString("ru-RU")}
          />
        </Card>
        <div className={styles.summary}>
          <Card className={styles.summaryItem} bordered={false}>
            <Statistic
              title="Доходы"
              value={totalIncome}
              precision={0}
              valueStyle={{
                color: "#A5D6A7",
                fontSize: "18px",
                fontWeight: 600,
              }}
              prefix="+"
              suffix="₽"
              formatter={(value) => value?.toLocaleString("ru-RU")}
            />
          </Card>
          <Card className={styles.summaryItem} bordered={false}>
            <Statistic
              title="Расходы"
              value={totalExpenses}
              precision={0}
              valueStyle={{
                color: "#FFAB91",
                fontSize: "18px",
                fontWeight: 600,
              }}
              prefix="-"
              suffix="₽"
              formatter={(value) => value?.toLocaleString("ru-RU")}
            />
          </Card>
        </div>
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

      <FloatButton
        icon={<PlusOutlined />}
        type="primary"
        onClick={() => setShowForm(true)}
      />

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
