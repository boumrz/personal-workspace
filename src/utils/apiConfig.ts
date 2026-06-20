// Utility to resolve API base URL.
// - Relative /api keeps requests same-origin (dev proxy / prod reverse proxy).
// - VITE_API_URL / __API_BASE_URL__ is used when API is hosted separately.
function resolveConfiguredApiBaseUrl(): string | null {
  if (typeof window !== "undefined") {
    const runtimeValue = (window as any).__API_BASE_URL__;
    if (typeof runtimeValue === "string" && runtimeValue.trim()) {
      return runtimeValue.trim();
    }
  }

  if (typeof __API_BASE_URL__ !== "undefined" && __API_BASE_URL__) {
    return __API_BASE_URL__.trim();
  }

  return null;
}

function shouldFallbackToProxy(configuredUrl: string): boolean {
  if (typeof window === "undefined" || window.location.protocol !== "https:") {
    return false;
  }

  try {
    const parsed = new URL(configuredUrl);
    return parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const getApiBaseUrl = (): string => {
  const configuredApiBaseUrl = resolveConfiguredApiBaseUrl();

  if (!configuredApiBaseUrl) {
    return "/api";
  }

  // Avoid browser mixed-content errors (https app page -> http API).
  if (shouldFallbackToProxy(configuredApiBaseUrl)) {
    return "/api";
  }

  return configuredApiBaseUrl;
};
