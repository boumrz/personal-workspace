import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Layout from "./components/Layout";
import FinancePage from "./pages/FinancePage";
import ProfilePage from "./pages/ProfilePage";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  FinanceContext,
  Transaction,
  Category,
  Saving,
} from "./context/FinanceContext";
import { apiService } from "./services/api";
import * as styles from "./App.module.css";

dayjs.locale("ru");

// Внутренний компонент, который имеет доступ к AuthContext
const AppContent: React.FC = () => {
  console.log("Проверка автодеплоя");
  const { user, token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<Transaction[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user || !token) {
        // Если пользователь не авторизован, очистить данные
        setTransactions([]);
        setPlannedExpenses([]);
        setSavings([]);
        setCategories([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [categoriesData, transactionsData, plannedData, savingsData] =
          await Promise.all([
            apiService.getCategories(),
            apiService.getTransactions(),
            apiService.getPlannedExpenses(),
            apiService.getSavings(),
          ]);

        setCategories(categoriesData);
        setTransactions(transactionsData);
        setPlannedExpenses(plannedData);
        setSavings(savingsData);
      } catch (error) {
        console.error("Error loading data:", error);
        // Fallback to default categories if API fails
        setCategories([
          { id: "1", name: "Продукты", color: "#FF8A65", icon: "Utensils" },
          { id: "2", name: "Транспорт", color: "#64B5F6", icon: "Car" },
          { id: "3", name: "Развлечения", color: "#BA68C8", icon: "Film" },
          { id: "4", name: "Здоровье", color: "#81C784", icon: "Hospital" },
          { id: "5", name: "Одежда", color: "#FFB74D", icon: "Shirt" },
          { id: "6", name: "Жилье", color: "#90CAF9", icon: "Home" },
          { id: "7", name: "Зарплата", color: "#66BB6A", icon: "Wallet" },
          { id: "8", name: "Другое", color: "#90A4AE", icon: "Package" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, token]);

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

  const addSaving = async (saving: Omit<Saving, "id">) => {
    try {
      const newSaving = await apiService.createSaving(saving);
      setSavings([newSaving, ...savings]);
    } catch (error) {
      console.error("Error adding saving:", error);
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

  const deleteSaving = async (id: string) => {
    try {
      await apiService.deleteSaving(id);
      setSavings(savings.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error deleting saving:", error);
      throw error;
    }
  };

  const addCategory = async (
    category: Omit<Category, "id">
  ): Promise<Category> => {
    try {
      const newCategory = await apiService.createCategory(category);
      setCategories([...categories, newCategory]);
      return newCategory;
    } catch (error) {
      console.error("Error adding category:", error);
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await apiService.deleteCategory(id);
      setCategories(categories.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  };

  if (loading) {
    return (
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
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <FinanceContext.Provider
                value={{
                  transactions,
                  plannedExpenses,
                  savings,
                  categories,
                  addTransaction,
                  addPlannedExpense,
                  addSaving,
                  deleteTransaction,
                  deletePlannedExpense,
                  deleteSaving,
                  addCategory,
                  deleteCategory,
                }}
              >
                <Layout>
                  <Routes>
                    <Route path="/finance/*" element={<FinancePage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route
                      path="/"
                      element={<Navigate to="/finance/transactions" replace />}
                    />
                  </Routes>
                </Layout>
              </FinanceContext.Provider>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: "#42A5F5",
        },
      }}
    >
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
