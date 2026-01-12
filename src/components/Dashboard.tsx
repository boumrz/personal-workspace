import React, { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import TransactionList from "./TransactionList";
import PlannedExpenses from "./PlannedExpenses";
import TransactionForm from "./TransactionForm";
import CategoryFilter from "./CategoryFilter";
import * as styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const { transactions, plannedExpenses, categories } = useFinance();
  const [activeTab, setActiveTab] = useState<"actual" | "planned">("actual");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const filteredTransactions = selectedCategory
    ? transactions.filter((t) => t.category.id === selectedCategory)
    : transactions;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Финансовый помощник</h1>
        <div className={styles.balanceCard}>
          <div className={styles.balanceLabel}>Баланс</div>
          <div
            className={`${styles.balanceAmount} ${
              balance >= 0 ? styles.positive : styles.negative
            }`}
          >
            {balance.toLocaleString("ru-RU")} ₽
          </div>
        </div>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>Доходы</div>
            <div className={styles.summaryAmountIncome}>
              +{totalIncome.toLocaleString("ru-RU")} ₽
            </div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>Расходы</div>
            <div className={styles.summaryAmountExpense}>
              -{totalExpenses.toLocaleString("ru-RU")} ₽
            </div>
          </div>
        </div>
      </header>

      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "actual" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("actual")}
        >
          Актуальные
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "planned" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("planned")}
        >
          Планируемые
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === "actual" ? (
          <TransactionList
            transactions={filteredTransactions}
            selectedCategory={selectedCategory}
          />
        ) : (
          <PlannedExpenses expenses={plannedExpenses} />
        )}
      </div>

      <button
        className={styles.addButton}
        onClick={() => setShowForm(true)}
        aria-label="Добавить операцию"
      >
        +
      </button>

      {showForm && (
        <TransactionForm
          onClose={() => setShowForm(false)}
          type={activeTab === "planned" ? "planned" : "actual"}
        />
      )}
    </div>
  );
};

export default Dashboard;
