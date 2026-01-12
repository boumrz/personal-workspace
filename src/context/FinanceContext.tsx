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

export interface FinanceContextType {
  transactions: Transaction[];
  plannedExpenses: Transaction[];
  categories: Category[];
  addTransaction: (transaction: Transaction) => void;
  addPlannedExpense: (expense: Transaction) => void;
  deleteTransaction: (id: string) => void;
  deletePlannedExpense: (id: string) => void;
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
