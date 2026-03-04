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
