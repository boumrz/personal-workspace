const API_BASE_URL = "http://localhost:3001/api";

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

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
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
      error.response = { data: { error: errorMessage }, status: response.status };
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

  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
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

  async createPlannedExpense(expense: Omit<Transaction, "id">): Promise<Transaction> {
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
