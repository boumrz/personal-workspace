/**
 * Shared TypeScript types for Finance Assistant (used by mobile app).
 * Copied from web app - web app is not modified.
 */

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

export interface SpeechParseContext {
  locale?: string;
  timezone?: string;
}

export interface ParsedSpeechTransactionItem {
  type: "income" | "expense";
  amount: number;
  date?: string;
  categoryHint?: string;
  categoryResolution?: "matched_existing" | "suggest_create" | "unknown";
  suggestedCategoryToCreate?: string;
}

export interface TransactionDraft {
  type: "income" | "expense";
  amount: number;
  date?: string;
  description?: string;
  categoryHint?: string;
  categoryResolution?: "matched_existing" | "suggest_create" | "unknown";
  suggestedCategoryToCreate?: string;
}

export interface ReceiptLineItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal: number;
}

export interface ReceiptMeta {
  source: "qr" | "ocr";
  qrPayload?: string;
  ocrEngine?: string;
  fiscalDriveNumber: string;
  fiscalDocumentNumber: string;
  fiscalSign: string;
  operationType: string;
  operationDateTime: string;
  amount: number;
  lineItems?: ReceiptLineItem[];
}

export interface TransactionImportPreview {
  source: "receipt";
  title: string;
  warnings: string[];
  drafts: TransactionDraft[];
  confidence?: number;
  receiptMeta?: ReceiptMeta;
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
  last_login_at?: string;
  login_count?: number;
  google_id?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
  /** Платформа входа: web | android | ios — для учёта статистики */
  platform?: "web" | "android" | "ios";
}

export interface RegisterRequest {
  fullName: string;
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: User;
}
