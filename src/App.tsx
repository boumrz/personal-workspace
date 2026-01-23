import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider } from "antd";
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

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: "#0A84FF",
          colorSuccess: "#34C759",
          colorError: "#FF3B30",
          colorWarning: "#FF9500",
          colorText: "#2c2c2e",
          colorTextSecondary: "#6c6c70",
          colorBorder: "#dcdce1",
          colorBgContainer: "#f2f2f6",
          colorBgLayout: "#e8e8ed",
          borderRadius: 10,
          borderRadiusLG: 12,
          borderRadiusSM: 8,
          fontFamily: '"Helvetica", "Helvetica Neue", Arial, sans-serif',
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
