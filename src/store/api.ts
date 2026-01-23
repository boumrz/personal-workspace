import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getApiBaseUrl } from "../utils/apiConfig";
import { Modal } from "antd";

// Интерфейсы
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

export interface Profile {
  id: number;
  login?: string;
  email?: string;
  name?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  age?: number;
  dateOfBirth?: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email?: string;
  login?: string;
  name?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Флаг для предотвращения множественных модальных окон
let errorModalShown = false;

// Функция для показа ошибки
const showErrorModal = (error: any) => {
  // Не показываем модальное окно для ошибок авторизации (они обрабатываются отдельно)
  if (error?.status === 401 || error?.status === 403) {
    return;
  }

  // Предотвращаем множественные модальные окна
  if (errorModalShown) {
    return;
  }

  const isNetworkError =
    error?.status === "FETCH_ERROR" ||
    error?.status === "PARSING_ERROR" ||
    (!error?.status && error?.error) ||
    error?.error === "Failed to fetch" ||
    error?.error?.includes("fetch");

  const message = isNetworkError
    ? "Не удалось подключиться к серверу. Пожалуйста, проверьте подключение к интернету и убедитесь, что VPN отключен, затем перезагрузите страницу."
    : error?.data?.error ||
      error?.error ||
      "Произошла ошибка при выполнении запроса. Пожалуйста, перезагрузите страницу.";

  errorModalShown = true;

  Modal.error({
    title: "Ошибка подключения",
    content: message,
    okText: "Перезагрузить страницу",
    onOk: () => {
      errorModalShown = false;
      window.location.reload();
    },
    onCancel: () => {
      errorModalShown = false;
    },
    width: 500,
  });
};

// Базовый запрос с интерцепторами
const baseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  prepareHeaders: (headers) => {
    const token = localStorage.getItem("token");
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    headers.set("Content-Type", "application/json");
    return headers;
  },
});

// Базовый запрос с обработкой ошибок
const baseQueryWithErrorHandling = async (
  args: any,
  api: any,
  extraOptions: any
) => {
  const result = await baseQuery(args, api, extraOptions);

  // Обработка ошибок
  if (result.error) {
    // Показываем модальное окно с ошибкой (только для сетевых ошибок и ошибок сервера)
    showErrorModal(result.error);
  }

  return result;
};

// Создание API
export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithErrorHandling,
  tagTypes: [
    "Category",
    "Transaction",
    "PlannedExpense",
    "Saving",
    "Profile",
    "Goal",
  ],
  endpoints: (builder) => ({
    // Auth endpoints
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    register: builder.mutation<LoginResponse, RegisterRequest>({
      query: (data) => ({
        url: "/auth/register",
        method: "POST",
        body: data,
      }),
    }),

    // Categories
    getCategories: builder.query<Category[], void>({
      query: () => "/categories",
      providesTags: ["Category"],
    }),
    createCategory: builder.mutation<Category, Omit<Category, "id">>({
      query: (category) => ({
        url: "/categories",
        method: "POST",
        body: category,
      }),
      invalidatesTags: ["Category"],
    }),
    deleteCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Category"],
    }),

    // Transactions
    getTransactions: builder.query<Transaction[], void>({
      query: () => "/transactions",
      providesTags: ["Transaction"],
    }),
    createTransaction: builder.mutation<Transaction, Omit<Transaction, "id">>({
      query: (transaction) => ({
        url: "/transactions",
        method: "POST",
        body: transaction,
      }),
      invalidatesTags: ["Transaction"],
    }),
    deleteTransaction: builder.mutation<void, string>({
      query: (id) => ({
        url: `/transactions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Transaction"],
    }),

    // Planned Expenses
    getPlannedExpenses: builder.query<Transaction[], void>({
      query: () => "/planned-expenses",
      providesTags: ["PlannedExpense"],
    }),
    createPlannedExpense: builder.mutation<
      Transaction,
      Omit<Transaction, "id">
    >({
      query: (expense) => ({
        url: "/planned-expenses",
        method: "POST",
        body: expense,
      }),
      invalidatesTags: ["PlannedExpense"],
    }),
    deletePlannedExpense: builder.mutation<void, string>({
      query: (id) => ({
        url: `/planned-expenses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PlannedExpense"],
    }),

    // Savings
    getSavings: builder.query<Saving[], void>({
      query: () => "/savings",
      providesTags: ["Saving"],
    }),
    createSaving: builder.mutation<Saving, Omit<Saving, "id">>({
      query: (saving) => ({
        url: "/savings",
        method: "POST",
        body: saving,
      }),
      invalidatesTags: ["Saving"],
    }),
    deleteSaving: builder.mutation<void, string>({
      query: (id) => ({
        url: `/savings/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Saving"],
    }),

    // Profile
    getProfile: builder.query<Profile, void>({
      query: () => "/profile",
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<Profile, Partial<Profile>>({
      query: (profile) => ({
        url: "/profile",
        method: "PUT",
        body: profile,
      }),
      invalidatesTags: ["Profile"],
    }),

    // Goals
    getGoals: builder.query<Goal[], void>({
      query: () => "/goals",
      providesTags: ["Goal"],
    }),
    createGoal: builder.mutation<
      Goal,
      Omit<Goal, "id" | "createdAt" | "updatedAt">
    >({
      query: (goal) => ({
        url: "/goals",
        method: "POST",
        body: goal,
      }),
      invalidatesTags: ["Goal"],
    }),
    updateGoal: builder.mutation<
      Goal,
      {
        id: string;
        goal: Partial<Omit<Goal, "id" | "createdAt" | "updatedAt">>;
      }
    >({
      query: ({ id, goal }) => ({
        url: `/goals/${id}`,
        method: "PUT",
        body: goal,
      }),
      invalidatesTags: ["Goal"],
    }),
    deleteGoal: builder.mutation<void, string>({
      query: (id) => ({
        url: `/goals/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Goal"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useGetPlannedExpensesQuery,
  useCreatePlannedExpenseMutation,
  useDeletePlannedExpenseMutation,
  useGetSavingsQuery,
  useCreateSavingMutation,
  useDeleteSavingMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetGoalsQuery,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
} = api;
