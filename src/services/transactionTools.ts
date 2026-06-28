import { getApiBaseUrl } from "../utils/apiConfig";

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

export interface ReceiptMeta {
  source: "qr" | "ocr" | "ocr_partial";
  qrPayload?: string;
  ocrEngine?: string;
  fiscalDriveNumber?: string;
  fiscalDocumentNumber?: string;
  fiscalSign?: string;
  operationType?: string;
  operationDateTime?: string;
  amount: number;
  lineItems?: Array<{
    name: string;
    quantity?: number;
    unitPrice?: number;
    lineTotal: number;
  }>;
  missingFiscalFields?: string[];
}

export interface ParsedTransactionsResponse {
  items: ParsedTransactionDraft[];
  confidence?: number;
  warnings?: string[];
  unparsedText?: string;
  receiptMeta?: ReceiptMeta;
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
  const statusLabel = response.status
    ? `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    : response.statusText || "network error";
  const fallback = `API error: ${statusLabel}`;
  try {
    const data = await response.clone().json();
    if (data?.code === "receipt_qr_not_found") {
      return "Сфотографируйте нижнюю часть чека крупнее или введите операцию вручную.";
    }
    if (data?.code === "receipt_qr_unreadable") {
      return "QR-код найден, но не читается. Сфотографируйте его крупнее, ровнее и без перекрывающего текста.";
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    try {
      const text = await response.clone().text();
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
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...getAuthHeaders(),
      },
    });
  } catch (error: any) {
    throw new Error(
      `Не удалось подключиться к API: ${error?.message || "проверьте интернет и адрес сервера"}`
    );
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

function isWebpReceipt(file: File) {
  return file.type.toLowerCase() === "image/webp" || file.name.toLowerCase().endsWith(".webp");
}

function toPngFilename(filename: string) {
  return filename.toLowerCase().endsWith(".webp")
    ? filename.replace(/\.webp$/i, ".png")
    : `${filename.replace(/\.[^.]+$/, "") || "receipt"}.png`;
}

async function convertWebpReceiptToPng(file: File): Promise<File> {
  if (!isWebpReceipt(file) || typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.drawImage(bitmap, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) {
      return file;
    }
    return new File([pngBlob], toPngFilename(file.name), { type: "image/png" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function parseReceiptPhoto(file: File): Promise<ParsedTransactionsResponse> {
  const uploadFile = await convertWebpReceiptToPng(file);
  const formData = new FormData();
  formData.append("file", uploadFile);
  formData.append("locale", "ru-RU");
  formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow");

  return requestJson<ParsedTransactionsResponse>("/v2/transactions/receipt/parse", {
    method: "POST",
    body: formData,
  });
}
