import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import Layout from "./components/Layout";
import FinancePage from "./pages/FinancePage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AdminRoute from "./components/AdminRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import {
  FinanceContext,
  Transaction,
  Category,
  Saving,
} from "./context/FinanceContext";
import {
  useGetCategoriesQuery,
  useGetTransactionsQuery,
  useGetPlannedExpensesQuery,
  useGetSavingsQuery,
  useCreateTransactionMutation,
  useCreatePlannedExpenseMutation,
  useCreateSavingMutation,
  useDeleteTransactionMutation,
  useDeletePlannedExpenseMutation,
  useDeleteSavingMutation,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
} from "./store/api";
import * as styles from "./App.module.css";

dayjs.locale("ru");

// Внутренний компонент, который имеет доступ к AuthContext
const AppContent: React.FC = () => {
  console.log("Проверка автодеплоя");
  const { user, token } = useAuth();
  
  // RTK Query хуки
  const {
    data: categoriesData = [],
    isLoading: categoriesLoading,
  } = useGetCategoriesQuery(undefined, { skip: !user || !token });
  
  const {
    data: transactionsData = [],
    isLoading: transactionsLoading,
  } = useGetTransactionsQuery(undefined, { skip: !user || !token });
  
  const {
    data: plannedExpensesData = [],
    isLoading: plannedExpensesLoading,
  } = useGetPlannedExpensesQuery(undefined, { skip: !user || !token });
  
  const {
    data: savingsData = [],
    isLoading: savingsLoading,
  } = useGetSavingsQuery(undefined, { skip: !user || !token });

  // Mutations
  const [createTransaction] = useCreateTransactionMutation();
  const [createPlannedExpense] = useCreatePlannedExpenseMutation();
  const [createSaving] = useCreateSavingMutation();
  const [deleteTransaction] = useDeleteTransactionMutation();
  const [deletePlannedExpense] = useDeletePlannedExpenseMutation();
  const [deleteSaving] = useDeleteSavingMutation();
  const [createCategory] = useCreateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const loading = categoriesLoading || transactionsLoading || plannedExpensesLoading || savingsLoading;

  // Преобразуем данные из API в формат для контекста
  const categories: Category[] = categoriesData;
  const transactions: Transaction[] = transactionsData;
  const plannedExpenses: Transaction[] = plannedExpensesData;
  const savings: Saving[] = savingsData;

  const addTransaction = async (transaction: Omit<Transaction, "id">) => {
    try {
      await createTransaction(transaction).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error adding transaction:", error);
      throw error;
    }
  };

  const addPlannedExpense = async (expense: Omit<Transaction, "id">) => {
    try {
      await createPlannedExpense(expense).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error adding planned expense:", error);
      throw error;
    }
  };

  const addSaving = async (saving: Omit<Saving, "id">) => {
    try {
      await createSaving(saving).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error adding saving:", error);
      throw error;
    }
  };

  const deleteTransactionHandler = async (id: string) => {
    try {
      await deleteTransaction(id).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  };

  const deletePlannedExpenseHandler = async (id: string) => {
    try {
      await deletePlannedExpense(id).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error deleting planned expense:", error);
      throw error;
    }
  };

  const deleteSavingHandler = async (id: string) => {
    try {
      await deleteSaving(id).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error deleting saving:", error);
      throw error;
    }
  };

  const addCategoryHandler = async (
    category: Omit<Category, "id">
  ): Promise<Category> => {
    try {
      const newCategory = await createCategory(category).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
      return newCategory;
    } catch (error) {
      console.error("Error adding category:", error);
      throw error;
    }
  };

  const deleteCategoryHandler = async (id: string) => {
    try {
      await deleteCategory(id).unwrap();
      // RTK Query автоматически обновит кэш через invalidatesTags
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-base)" }}>
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
                  deleteTransaction: deleteTransactionHandler,
                  deletePlannedExpense: deletePlannedExpenseHandler,
                  deleteSaving: deleteSavingHandler,
                  addCategory: addCategoryHandler,
                  deleteCategory: deleteCategoryHandler,
                }}
              >
                <Layout>
                  <Routes>
                    <Route path="/finance/*" element={<FinancePage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminPage />
                        </AdminRoute>
                      }
                    />
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

// Компонент-обертка для ConfigProvider с поддержкой темы
const ThemedApp: React.FC = () => {
  const { theme } = useTheme();
  
  // Динамические цвета в зависимости от темы
  const themeTokens = theme === "dark" ? {
    colorPrimary: "#5AA8DB",
    colorSuccess: "#30D158",
    colorError: "#FF6961",
    colorWarning: "#FF9F0A",
    colorText: "#F5F5F7",
    colorTextSecondary: "#AEAEB2",
    colorTextTertiary: "#8E8E93",
    colorBorder: "#48484A",
    colorBorderSecondary: "#38383A",
    colorBgContainer: "#1C1C1E",
    colorBgElevated: "#1C1C1E",
    colorBgLayout: "#000000",
    colorBgSpotlight: "#2C2C2E",
    colorBgMask: "rgba(0, 0, 0, 0.75)",
    colorFill: "#2C2C2E",
    colorFillSecondary: "#3A3A3C",
    colorFillTertiary: "#48484A",
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    fontFamily: '"Helvetica", "Helvetica Neue", Arial, sans-serif',
  } : {
    colorPrimary: "#4A9ED6",
    colorSuccess: "#34C759",
    colorError: "#D96560",
    colorWarning: "#FF9500",
    colorText: "#2C2C2E",
    colorTextSecondary: "#6C6C70",
    colorTextTertiary: "#8E8E93",
    colorBorder: "#DCDCE1",
    colorBorderSecondary: "#CECED3",
    colorBgContainer: "#F2F2F6",
    colorBgElevated: "#FFFFFF",
    colorBgLayout: "#E8E8ED",
    colorBgSpotlight: "#DEDEE3",
    colorBgMask: "rgba(0, 0, 0, 0.45)",
    colorFill: "#ECECF0",
    colorFillSecondary: "#DEDEE3",
    colorFillTertiary: "#D1D1D6",
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    fontFamily: '"Helvetica", "Helvetica Neue", Arial, sans-serif',
  };

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: themeTokens,
      }}
    >
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
};

export default App;
