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
import { apiService } from "./services/api";
import * as styles from "./App.module.css";

dayjs.locale("ru");

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesData, transactionsData, plannedData] = await Promise.all(
        [
          apiService.getCategories(),
          apiService.getTransactions(),
          apiService.getPlannedExpenses(),
        ]
      );

      setCategories(categoriesData);
      setTransactions(transactionsData);
      setPlannedExpenses(plannedData);
    } catch (error) {
      console.error("Error loading data:", error);
      // Fallback to default categories if API fails
      setCategories([
        { id: "1", name: "Продукты", color: "#ef4444", icon: "🍔" },
        { id: "2", name: "Транспорт", color: "#3b82f6", icon: "🚗" },
        { id: "3", name: "Развлечения", color: "#8b5cf6", icon: "🎬" },
        { id: "4", name: "Здоровье", color: "#10b981", icon: "🏥" },
        { id: "5", name: "Одежда", color: "#f59e0b", icon: "👕" },
        { id: "6", name: "Жилье", color: "#6366f1", icon: "🏠" },
        { id: "7", name: "Зарплата", color: "#22c55e", icon: "💰" },
        { id: "8", name: "Другое", color: "#6b7280", icon: "📦" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, "id">) => {
    try {
      const newTransaction = await apiService.createTransaction(transaction);
      setTransactions([newTransaction, ...transactions]);
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  };

  const addPlannedExpense = async (expense: Omit<Transaction, "id">) => {
    try {
      const newExpense = await apiService.createPlannedExpense(expense);
      setPlannedExpenses([newExpense, ...plannedExpenses]);
    } catch (error) {
      console.error("Error adding planned expense:", error);
      throw error;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await apiService.deleteTransaction(id);
      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  };

  const deletePlannedExpense = async (id: string) => {
    try {
      await apiService.deletePlannedExpense(id);
      setPlannedExpenses(plannedExpenses.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Error deleting planned expense:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <ConfigProvider locale={ruRU}>
        <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100vh",
            }}
          >
            Загрузка...
          </div>
        </div>
      </ConfigProvider>
    );
  }

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
        <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
          <Dashboard />
        </div>
      </FinanceContext.Provider>
    </ConfigProvider>
  );
};

export default App;
