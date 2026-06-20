/**
 * API base URL for the backend.
 * Development: use your machine's IP or localhost (for emulator use 10.0.2.2:3001 for Android emulator).
 * Production: set to your deployed API URL, e.g. https://yourdomain.com/api
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3001/api";

/**
 * MyTracker SDK key for analytics (Android/iOS).
 * Local: set EXPO_PUBLIC_MYTRACKER_SDK_KEY in mobile/.env
 * Production: set in EAS project Secrets.
 */
export const MYTRACKER_SDK_KEY =
  process.env.EXPO_PUBLIC_MYTRACKER_SDK_KEY ?? "";

/**
 * VK ID app id for Android OAuth flow.
 * Set EXPO_PUBLIC_VK_ID_APP_ID in EAS secrets or mobile/.env
 */
export const VK_ID_APP_ID =
  process.env.EXPO_PUBLIC_VK_ID_APP_ID ?? "";

/**
 * Deep link scheme used by Expo auth redirect.
 * Must match app.json -> expo.scheme
 */
export const VK_ID_REDIRECT_SCHEME =
  process.env.EXPO_PUBLIC_VK_ID_REDIRECT_SCHEME ?? "financeassistant";

/**
 * Optional voice parser provider override for /v2/transactions/parse.
 * Useful for quick local switching between LLM providers without code changes.
 */
export const SPEECH_PARSE_PROVIDER =
  process.env.EXPO_PUBLIC_SPEECH_PARSE_PROVIDER ?? "";

export const APP_DEEP_LINK_SCHEME = "financeassistant";

export const DATA_TOOL_ENDPOINTS = {
  exportExcel: "/v2/transactions/export",
  importExcel: "/v2/transactions/import",
  parseReceipt: "/v2/transactions/receipt/parse",
} as const;
