import React, { createContext, useContext } from "react";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: Category;
  description: string;
  date: string;
}

export interface Saving {
  id: string;
  amount: number;
  description: string;
  date: string;
}

export interface FinanceContextType {
  transactions: Transaction[];
  plannedExpenses: Transaction[];
  savings: Saving[];
  categories: Category[];
  addTransaction: (transaction: Omit<Transaction, "id">) => Promise<void>;
  addPlannedExpense: (expense: Omit<Transaction, "id">) => Promise<void>;
  addSaving: (saving: Omit<Saving, "id">) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deletePlannedExpense: (id: string) => Promise<void>;
  deleteSaving: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, "id">) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
}

export const FinanceContext = createContext<FinanceContextType | undefined>(
  undefined
);

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within FinanceContext");
  }
  return context;
};
