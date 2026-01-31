/**
 * Shared utils for Finance Assistant mobile app.
 * getApiBaseUrl: mobile app must set API_BASE_URL or pass baseUrl to API client.
 */

let apiBaseUrl = "http://localhost:3001/api";

/**
 * Set API base URL (call from mobile app with your backend URL).
 * E.g. setApiBaseUrl('https://yourdomain.com/api') for production.
 */
export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url.replace(/\/$/, "");
}

/**
 * Get current API base URL.
 * In mobile, set it via setApiBaseUrl() before making requests.
 */
export function getApiBaseUrl(): string {
  return apiBaseUrl;
}
