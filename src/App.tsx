import React, { useState, useEffect } from "react";
import { ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Dashboard from "./components/Dashboard";
import {
  FinanceContext,
  Transaction,
  Category,
} from "./context/FinanceContext";
import * as styles from "./App.module.css";

dayjs.locale("ru");

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<Transaction[]>([]);
  const [categories] = useState<Category[]>([
    { id: "1", name: "Продукты", color: "#ef4444", icon: "🍔" },
    { id: "2", name: "Транспорт", color: "#3b82f6", icon: "🚗" },
    { id: "3", name: "Развлечения", color: "#8b5cf6", icon: "🎬" },
    { id: "4", name: "Здоровье", color: "#10b981", icon: "🏥" },
    { id: "5", name: "Одежда", color: "#f59e0b", icon: "👕" },
    { id: "6", name: "Жилье", color: "#6366f1", icon: "🏠" },
    { id: "7", name: "Зарплата", color: "#22c55e", icon: "💰" },
    { id: "8", name: "Другое", color: "#6b7280", icon: "📦" },
  ]);

  useEffect(() => {
    const savedTransactions = localStorage.getItem("transactions");
    const savedPlanned = localStorage.getItem("plannedExpenses");

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }
    if (savedPlanned) {
      setPlannedExpenses(JSON.parse(savedPlanned));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("plannedExpenses", JSON.stringify(plannedExpenses));
  }, [plannedExpenses]);

  const addTransaction = (transaction: Transaction) => {
    setTransactions([transaction, ...transactions]);
  };

  const addPlannedExpense = (expense: Transaction) => {
    setPlannedExpenses([expense, ...plannedExpenses]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const deletePlannedExpense = (id: string) => {
    setPlannedExpenses(plannedExpenses.filter((e) => e.id !== id));
  };

  return (
    <ConfigProvider locale={ruRU}>
      <FinanceContext.Provider
        value={{
          transactions,
          plannedExpenses,
          categories,
          addTransaction,
          addPlannedExpense,
          deleteTransaction,
          deletePlannedExpense,
        }}
      >
        <div className={styles.app}>
          <Dashboard />
        </div>
      </FinanceContext.Provider>
    </ConfigProvider>
  );
};

export default App;
