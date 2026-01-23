import { getApiBaseUrl } from "../utils/apiConfig";

const API_BASE_URL: string = getApiBaseUrl();

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

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem("token");
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Если не удалось распарсить JSON, используем стандартное сообщение
      }
      const error: any = new Error(errorMessage);
      error.response = {
        data: { error: errorMessage },
        status: response.status,
      };
      throw error;
    }

    return response.json();
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
    return this.request<void>(`/categories/${id}`, {
      method: "DELETE",
    });
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return this.request<Transaction[]>("/transactions");
  }

  async createTransaction(
    transaction: Omit<Transaction, "id">
  ): Promise<Transaction> {
    return this.request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.request<void>(`/transactions/${id}`, {
      method: "DELETE",
    });
  }

  // Planned Expenses
  async getPlannedExpenses(): Promise<Transaction[]> {
    return this.request<Transaction[]>("/planned-expenses");
  }

  async createPlannedExpense(
    expense: Omit<Transaction, "id">
  ): Promise<Transaction> {
    return this.request<Transaction>("/planned-expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    });
  }

  async deletePlannedExpense(id: string): Promise<void> {
    return this.request<void>(`/planned-expenses/${id}`, {
      method: "DELETE",
    });
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
    return this.request<void>(`/savings/${id}`, {
      method: "DELETE",
    });
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

  async createGoal(
    goal: Omit<Goal, "id" | "createdAt" | "updatedAt">
  ): Promise<Goal> {
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
    return this.request<void>(`/goals/${id}`, {
      method: "DELETE",
    });
  }
}

export const apiService = new ApiService();
