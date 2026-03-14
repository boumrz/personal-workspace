/**
 * Shared analytics client for Finance Assistant.
 * Web: uses Yandex.Metrika (see index.html). This module is used by mobile to send events to backend.
 * Mobile: set platform and optionally auth token, then call track().
 */

import { getApiBaseUrl } from "../utils";

let platform: "web" | "android" | "ios" = "web";
let authToken: string | null = null;

export function setAnalyticsPlatform(p: "web" | "android" | "ios"): void {
  platform = p;
}

export function getAnalyticsPlatform(): "web" | "android" | "ios" {
  return platform;
}

export function setAnalyticsAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Send analytics event to backend (used by mobile; web can keep using only Yandex.Metrika).
 */
export function track(event: string, params?: Record<string, unknown>): void {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/analytics/event`;
  const body = { event, platform, ...params };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).catch(() => {
    // Fire-and-forget; do not break app if analytics fails
  });
}
