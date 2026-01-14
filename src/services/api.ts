// API URL определяется автоматически:
// - В разработке (localhost:3000) используется http://localhost:3001/api
// - В продакшене используется относительный путь /api (Nginx проксирует на бэкенд)
const getApiBaseUrl = (): string => {
  // Автоматическое определение: если на localhost - используем localhost:3001, иначе относительный путь
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Для localhost используем прямой доступ к бэкенду
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001/api";
    }

    // Для продакшена используем относительный путь (Nginx проксирует /api на бэкенд)
    return "/api";
  }

  // Fallback для SSR или других случаев
  return "/api";
};

const API_BASE_URL: string = getApiBaseUrl();

// Логирование для отладки (временно включено для проверки)
console.log(
  "API_BASE_URL:",
  API_BASE_URL,
  "hostname:",
  typeof window !== "undefined" ? window.location.hostname : "N/A"
);

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
}

export const apiService = new ApiService();
