import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getApiBaseUrl } from "../utils/apiConfig";
import { Modal } from "antd";

// Интерфейсы
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type?: "income" | "expense" | "both";
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
  telegramId?: string | null;
  vkId?: string | null;
  voiceLlmProvider?: string | null;
  voiceLlmProviderChain?: string[] | null;
  hasPassword?: boolean;
  authMethodsCount?: number;
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

export interface AdminUser {
  id: number;
  login?: string;
  email?: string;
  name?: string;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  age?: number;
  date_of_birth?: string;
  created_at: string;
  first_login_at?: string;
  last_login_at?: string;
  last_login_web_at?: string;
  last_login_mobile_at?: string;
  login_count?: number;
  login_count_web?: number;
  login_count_mobile?: number;
  voice_llm_provider?: string | null;
  voice_llm_provider_chain?: string | null;
  voice_llm_enabled_providers?: string | null;
  google_id?: string;
}

export interface LlmProvider {
  id: string;
  label: string;
  model: string | null;
}

export interface SpeechParseContext {
  locale?: string;
  timezone?: string;
}

export interface ParsedSpeechTransactionItem {
  type: "income" | "expense";
  amount: number;
  description?: string;
  categoryHint?: string;
  categoryResolution?: "matched_existing" | "suggest_create" | "unknown";
  suggestedCategoryToCreate?: string;
  date?: string;
  confidence?: number;
}

export interface ParseTransactionsFromSpeechRequest {
  text: string;
  mode?: "actual" | "planned";
  context?: SpeechParseContext;
  provider?:
    | "gigachat"
    | "gpt4free"
    | "gemini"
    | "gemini-flash-lite"
    | "groq"
    | "openrouter"
    | "heuristic";
  providerChain?: (
    | "gigachat"
    | "gpt4free"
    | "gemini"
    | "gemini-flash-lite"
    | "groq"
    | "openrouter"
    | "heuristic"
  )[];
}

export interface ParseTransactionsFromSpeechResponse {
  items: ParsedSpeechTransactionItem[];
  confidence: number;
  warnings: string[];
  unparsedText?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
  platform?: "web" | "android" | "ios";
}

export interface RegisterRequest {
  login: string;
  password: string;
}

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  platform?: "web" | "android" | "ios";
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
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

const REFRESH_TOKEN_KEY = "refreshToken";

/** Один общий промис обновления токена, чтобы не дергать refresh параллельно из нескольких запросов */
let refreshPromise: Promise<{ token: string; refreshToken: string; user?: User } | null> | null = null;

async function doRefresh(): Promise<{ token: string; refreshToken: string; user?: User } | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.token) return null;
    return {
      token: data.token,
      refreshToken: data.refreshToken ?? refreshToken,
      user: data.user,
    };
  } catch {
    return null;
  }
}

function refreshTokens(): Promise<{ token: string; refreshToken: string; user?: User } | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function clearSessionAndRedirectToLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("user");
  sessionStorage.setItem("sessionExpired", "1");
  window.location.href = "/login";
}

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

// Базовый запрос с обработкой ошибок и повторной авторизацией по refresh
const baseQueryWithErrorHandling = async (
  args: any,
  api: any,
  extraOptions: any
) => {
  let result = await baseQuery(args, api, extraOptions);

  // 401/403 — пробуем обновить токен и повторить запрос один раз
  if (result.error && (result.error.status === 401 || result.error.status === 403)) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      localStorage.setItem("token", refreshed.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
      if (refreshed.user) {
        localStorage.setItem("user", JSON.stringify(refreshed.user));
      }
      result = await baseQuery(args, api, extraOptions);
    } else {
      clearSessionAndRedirectToLogin();
      return result;
    }
  }

  // Остальные ошибки — показываем модалку (кроме 401/403, которые уже обработаны выше)
  if (result.error && result.error.status !== 401 && result.error.status !== 403) {
    showErrorModal(result.error);
  }

  return result;
};

// Создание API
export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithErrorHandling,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: [
    "Category",
    "Transaction",
    "PlannedExpense",
    "Saving",
    "Profile",
    "Goal",
    "AdminUser",
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
    loginWithTelegram: builder.mutation<LoginResponse, TelegramAuthData>({
      query: (data) => ({
        url: "/auth/telegram",
        method: "POST",
        body: data,
      }),
    }),
    loginWithVkId: builder.mutation<
      LoginResponse,
      { access_token: string; app_id?: string; platform?: "web" | "android" | "ios" }
    >({
      query: (data) => ({
        url: "/auth/vkid",
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
    updateTransaction: builder.mutation<
      Transaction,
      { id: string; data: Partial<Omit<Transaction, "id">> }
    >({
      query: ({ id, data }) => ({
        url: `/transactions/${id}`,
        method: "PUT",
        body: data,
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
    parseTransactionsFromSpeech: builder.mutation<
      ParseTransactionsFromSpeechResponse,
      ParseTransactionsFromSpeechRequest
    >({
      query: (payload) => ({
        url: "/v2/transactions/parse",
        method: "POST",
        body: payload,
      }),
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
    updatePlannedExpense: builder.mutation<
      Transaction,
      { id: string; data: Partial<Omit<Transaction, "id">> }
    >({
      query: ({ id, data }) => ({
        url: `/planned-expenses/${id}`,
        method: "PUT",
        body: data,
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
    updateSaving: builder.mutation<
      Saving,
      { id: string; data: Partial<Omit<Saving, "id">> }
    >({
      query: ({ id, data }) => ({
        url: `/savings/${id}`,
        method: "PUT",
        body: data,
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
    linkTelegram: builder.mutation<{ success: boolean }, TelegramAuthData>({
      query: (data) => ({
        url: "/profile/link/telegram",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Profile"],
    }),
    unlinkTelegram: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/profile/unlink/telegram",
        method: "POST",
      }),
      invalidatesTags: ["Profile"],
    }),
    linkVkId: builder.mutation<{ success: boolean }, { access_token: string; app_id?: string }>({
      query: (data) => ({
        url: "/profile/link/vkid",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Profile"],
    }),
    unlinkVk: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/profile/unlink/vk",
        method: "POST",
      }),
      invalidatesTags: ["Profile"],
    }),
    setPassword: builder.mutation<{ success: boolean }, { password: string; login: string }>({
      query: ({ password, login }) => ({
        url: "/profile/set-password",
        method: "POST",
        body: { password, login },
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

    // Admin endpoints
    getAdminUsers: builder.query<AdminUser[], void>({
      query: () => "/admin/users",
      transformResponse: (response: { users: AdminUser[] }) => response.users,
      providesTags: ["AdminUser"],
    }),
    updateAdminUser: builder.mutation<
      AdminUser,
      { id: number; user: Partial<AdminUser & { password?: string }> }
    >({
      query: ({ id, user }) => ({
        url: `/admin/users/${id}`,
        method: "PUT",
        body: user,
      }),
      invalidatesTags: ["AdminUser"],
    }),
    deleteAdminUser: builder.mutation<void, number>({
      query: (id) => ({
        url: `/admin/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AdminUser"],
    }),
    getAdminLlmProviders: builder.query<{ providers: LlmProvider[] }, void>({
      query: () => "/admin/llm-providers",
    }),
    updateAdminUserLlm: builder.mutation<
      { user: { id: number; voice_llm_provider_chain?: string; voice_llm_enabled_providers?: string } },
      { id: number; voice_llm_provider_chain?: string[]; voice_llm_enabled_providers?: string[] }
    >({
      query: ({ id, voice_llm_provider_chain, voice_llm_enabled_providers }) => ({
        url: `/admin/users/${id}/llm`,
        method: "PUT",
        body: { voice_llm_provider_chain, voice_llm_enabled_providers },
      }),
      invalidatesTags: ["AdminUser"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLoginWithTelegramMutation,
  useLoginWithVkIdMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useParseTransactionsFromSpeechMutation,
  useGetPlannedExpensesQuery,
  useCreatePlannedExpenseMutation,
  useUpdatePlannedExpenseMutation,
  useDeletePlannedExpenseMutation,
  useGetSavingsQuery,
  useCreateSavingMutation,
  useUpdateSavingMutation,
  useDeleteSavingMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useLinkTelegramMutation,
  useUnlinkTelegramMutation,
  useLinkVkIdMutation,
  useUnlinkVkMutation,
  useSetPasswordMutation,
  useGetGoalsQuery,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
  useGetAdminUsersQuery,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useGetAdminLlmProvidersQuery,
  useUpdateAdminUserLlmMutation,
} = api;
