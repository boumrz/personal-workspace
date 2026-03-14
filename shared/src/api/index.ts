/**
 * API client for Finance Assistant mobile app.
 * Uses fetch; getToken and baseUrl are injected so it works in React Native (AsyncStorage, config).
 */

import type {
  Category,
  Transaction,
  Saving,
  Profile,
  Goal,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  ParseTransactionsFromSpeechRequest,
  ParseTransactionsFromSpeechResponse,
} from "../types";
import { getApiBaseUrl } from "../utils";

export type GetTokenFn = () => string | null | Promise<string | null>;

export interface RefreshResponse {
  token: string;
  refreshToken?: string;
  user?: { id: number; login?: string; email?: string; name?: string };
}

export interface VkIdLoginRequest {
  access_token: string;
  app_id?: string;
  platform?: "web" | "android" | "ios";
}

export interface VkIdLinkRequest {
  access_token: string;
  app_id?: string;
}

export interface ApiClientOptions {
  baseUrl?: string;
  getToken: GetTokenFn;
  /** Для обновления access по 401/403. Если не задан, при 401/403 вызывается только onSessionExpired */
  getRefreshToken?: () => string | null | Promise<string | null>;
  /** Вызывается после успешного refresh; нужно сохранить новые токены */
  onTokensRefreshed?: (token: string, refreshToken?: string, user?: RefreshResponse["user"]) => void;
  /** Вызывается, когда refresh не удался или токена нет — выход и редирект на логин */
  onSessionExpired?: () => void;
}

export class ApiClient {
  private getToken: GetTokenFn;
  private baseUrl: string;
  private getRefreshToken?: ApiClientOptions["getRefreshToken"];
  private onTokensRefreshed?: ApiClientOptions["onTokensRefreshed"];
  private onSessionExpired?: ApiClientOptions["onSessionExpired"];
  private refreshPromise: Promise<RefreshResponse | null> | null = null;

  constructor(options: ApiClientOptions) {
    this.getToken = options.getToken;
    this.baseUrl = options.baseUrl ?? getApiBaseUrl();
    this.getRefreshToken = options.getRefreshToken;
    this.onTokensRefreshed = options.onTokensRefreshed;
    this.onSessionExpired = options.onSessionExpired;
  }

  private async resolveToken(): Promise<string | null> {
    const t = this.getToken();
    return t instanceof Promise ? t : Promise.resolve(t);
  }

  private async doRefresh(): Promise<RefreshResponse | null> {
    const getRef = this.getRefreshToken;
    if (!getRef) return null;
    const r = getRef();
    const refreshToken = r instanceof Promise ? await r : r;
    if (!refreshToken) return null;
    const url = `${this.baseUrl.replace(/\/$/, "")}/auth/refresh`;
    try {
      const res = await fetch(url, {
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

  private refreshTokens(): Promise<RefreshResponse | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async request<T>(endpoint: string, options?: RequestInit, isRetry = false): Promise<T> {
    const token = await this.resolveToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const url = `${this.baseUrl.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[API]", options?.method ?? "GET", url);
    }
    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err: any) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[API] Network error:", url, err?.message ?? err);
      }
      throw err;
    }
    if (!response.ok) {
      const status = response.status;
      if ((status === 401 || status === 403) && !isRetry && this.getRefreshToken && this.onTokensRefreshed && this.onSessionExpired) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          this.onTokensRefreshed(refreshed.token, refreshed.refreshToken, refreshed.user);
          return this.request<T>(endpoint, options, true);
        }
        this.onSessionExpired();
      }
      let errorMessage = `API error: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch {
        // ignore
      }
      const err: any = new Error(errorMessage);
      err.response = { data: { error: errorMessage }, status: response.status };
      throw err;
    }
    return response.json() as Promise<T>;
  }

  // Auth (no token required)
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async loginWithVkId(data: VkIdLoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("/auth/vkid", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async linkVkId(data: VkIdLinkRequest): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>("/profile/link/vkid", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async unlinkVk(): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>("/profile/unlink/vk", {
      method: "POST",
    });
  }

  async setPassword(
    password: string,
    login: string
  ): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>("/profile/set-password", {
      method: "POST",
      body: JSON.stringify({ password, login }),
    });
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>("/categories");
  }
  async createCategory(category: Omit<Category, "id">): Promise<Category> {
    return this.request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(category),
    });
  }
  async deleteCategory(id: string): Promise<void> {
    return this.request<void>(`/categories/${id}`, { method: "DELETE" });
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return this.request<Transaction[]>("/transactions");
  }
  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    return this.request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
  }
  async updateTransaction(id: string, transaction: Partial<Omit<Transaction, "id">>): Promise<Transaction> {
    return this.request<Transaction>(`/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(transaction),
    });
  }
  async deleteTransaction(id: string): Promise<void> {
    return this.request<void>(`/transactions/${id}`, { method: "DELETE" });
  }

  async parseTransactionsFromSpeech(
    payload: ParseTransactionsFromSpeechRequest
  ): Promise<ParseTransactionsFromSpeechResponse> {
    return this.request<ParseTransactionsFromSpeechResponse>("/v2/transactions/parse", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Planned Expenses
  async getPlannedExpenses(): Promise<Transaction[]> {
    return this.request<Transaction[]>("/planned-expenses");
  }
  async createPlannedExpense(expense: Omit<Transaction, "id">): Promise<Transaction> {
    return this.request<Transaction>("/planned-expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    });
  }
  async updatePlannedExpense(id: string, expense: Partial<Omit<Transaction, "id">>): Promise<Transaction> {
    return this.request<Transaction>(`/planned-expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(expense),
    });
  }
  async deletePlannedExpense(id: string): Promise<void> {
    return this.request<void>(`/planned-expenses/${id}`, { method: "DELETE" });
  }

  // Savings
  async getSavings(): Promise<Saving[]> {
    return this.request<Saving[]>("/savings");
  }
  async createSaving(saving: Omit<Saving, "id">): Promise<Saving> {
    return this.request<Saving>("/savings", {
      method: "POST",
      body: JSON.stringify(saving),
    });
  }
  async updateSaving(id: string, saving: Partial<Omit<Saving, "id">>): Promise<Saving> {
    return this.request<Saving>(`/savings/${id}`, {
      method: "PUT",
      body: JSON.stringify(saving),
    });
  }
  async deleteSaving(id: string): Promise<void> {
    return this.request<void>(`/savings/${id}`, { method: "DELETE" });
  }

  // Profile
  async getProfile(): Promise<Profile> {
    return this.request<Profile>("/profile");
  }
  async updateProfile(profile: Partial<Profile>): Promise<Profile> {
    return this.request<Profile>("/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  }

  // Goals
  async getGoals(): Promise<Goal[]> {
    return this.request<Goal[]>("/goals");
  }
  async createGoal(goal: Omit<Goal, "id" | "createdAt" | "updatedAt">): Promise<Goal> {
    return this.request<Goal>("/goals", {
      method: "POST",
      body: JSON.stringify(goal),
    });
  }
  async updateGoal(
    id: string,
    goal: Partial<Omit<Goal, "id" | "createdAt" | "updatedAt">>
  ): Promise<Goal> {
    return this.request<Goal>(`/goals/${id}`, {
      method: "PUT",
      body: JSON.stringify(goal),
    });
  }
  async deleteGoal(id: string): Promise<void> {
    return this.request<void>(`/goals/${id}`, { method: "DELETE" });
  }
}
