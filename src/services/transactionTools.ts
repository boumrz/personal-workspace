import { getApiBaseUrl } from "../utils/apiConfig";

export type TransactionsExportScope = "all" | "actual" | "planned";
export type TransactionsTargetMode = "actual" | "planned";

export interface ParsedTransactionDraft {
  type: "income" | "expense";
  amount: number;
  description?: string;
  categoryHint?: string;
  categoryResolution?: "matched_existing" | "suggest_create" | "unknown";
  suggestedCategoryToCreate?: string;
  date?: string;
  confidence?: number;
}

export interface ParsedTransactionsResponse {
  items: ParsedTransactionDraft[];
  confidence?: number;
  warnings?: string[];
  unparsedText?: string;
}

interface BlobDownloadResponse {
  blob: Blob;
  filename: string;
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}) {
  const token = localStorage.getItem("token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

function buildUrl(path: string) {
  return `${getApiBaseUrl().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `API error: ${response.statusText}`;
  try {
    const data = await response.json();
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    try {
      const text = await response.text();
      if (text.trim()) {
        return text.slice(0, 200);
      }
    } catch {
      // ignore
    }
  }
  return fallback;
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function requestBlob(path: string, init: RequestInit): Promise<BlobDownloadResponse> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch =
    disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i) || [];
  const rawFilename = decodeURIComponent(filenameMatch[1] || filenameMatch[2] || "transactions-export.xlsx");
  const filename = rawFilename.toLowerCase().endsWith(".xlsx")
    ? rawFilename
    : `${rawFilename.replace(/\.[^.]+$/, "")}.xlsx`;

  return { blob, filename };
}

export async function exportTransactionsToExcel(scope: TransactionsExportScope) {
  return requestBlob("/v2/transactions/export", {
    method: "POST",
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scope }),
  });
}

export async function importTransactionsFromExcel(
  file: File,
  targetMode: TransactionsTargetMode
): Promise<ParsedTransactionsResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetMode", targetMode);
  formData.append("locale", "ru-RU");

  return requestJson<ParsedTransactionsResponse>("/v2/transactions/import", {
    method: "POST",
    body: formData,
  });
}

export async function parseReceiptPhoto(file: File): Promise<ParsedTransactionsResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("locale", "ru-RU");
  formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow");

  return requestJson<ParsedTransactionsResponse>("/v2/transactions/receipt/parse", {
    method: "POST",
    body: formData,
  });
}
