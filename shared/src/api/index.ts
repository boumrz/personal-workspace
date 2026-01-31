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
} from "../types";
import { getApiBaseUrl } from "../utils";

export type GetTokenFn = () => string | null | Promise<string | null>;

export interface ApiClientOptions {
  baseUrl?: string;
  getToken: GetTokenFn;
}

export class ApiClient {
  private getToken: GetTokenFn;
  private baseUrl: string;

  constructor(options: ApiClientOptions) {
    this.getToken = options.getToken;
    this.baseUrl = options.baseUrl ?? getApiBaseUrl();
  }

  private async resolveToken(): Promise<string | null> {
    const t = this.getToken();
    return t instanceof Promise ? t : Promise.resolve(t);
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
  async deleteTransaction(id: string): Promise<void> {
    return this.request<void>(`/transactions/${id}`, { method: "DELETE" });
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
