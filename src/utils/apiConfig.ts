// Утилита для определения базового URL API
// - Относительный путь /api — запросы идут на тот же домен (dev: proxy → бэкенд, prod: Nginx → бэкенд)
// - VITE_API_URL / __API_BASE_URL__ — для GitHub Pages или кастомного деплоя, когда API на другом домене
export const getApiBaseUrl = (): string => {
  if (typeof __API_BASE_URL__ !== "undefined" && __API_BASE_URL__) {
    return __API_BASE_URL__;
  }

  if (typeof window !== "undefined") {
    const apiUrlFromBuild = (window as any).__API_BASE_URL__;
    if (apiUrlFromBuild) {
      return apiUrlFromBuild;
    }
    return "/api";
  }
  return "/api";
};
