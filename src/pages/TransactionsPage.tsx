import React, { useState } from "react";
import { Tabs, FloatButton } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useFinance } from "../context/FinanceContext";
import TransactionList from "../components/TransactionList";
import PlannedExpenses from "../components/PlannedExpenses";
import TransactionForm from "../components/TransactionForm";
import CategoryFilter from "../components/CategoryFilter";
import * as styles from "./TransactionsPage.module.css";

const TransactionsPage: React.FC = () => {
  const { transactions, plannedExpenses } = useFinance();
  const [activeTab, setActiveTab] = useState<"actual" | "planned">("actual");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filteredTransactions = selectedCategory
    ? transactions.filter((t) => t.category.id === selectedCategory)
    : transactions;

  const tabItems = [
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
  ];

  return (
    <div className={styles.transactionsPage}>
      <h1 className={styles.pageTitle}>Расчет</h1>

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

export default TransactionsPage;
