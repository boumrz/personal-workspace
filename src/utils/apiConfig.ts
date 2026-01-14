// Утилита для определения базового URL API
// - В разработке (localhost:3000) используется http://localhost:3001/api
// - В продакшене используется относительный путь /api (Nginx проксирует на бэкенд)
export const getApiBaseUrl = (): string => {
  // Автоматическое определение: если на localhost - используем localhost:3001, иначе относительный путь
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Для localhost используем прямой доступ к бэкенду
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001/api";
    }

    // Для продакшена используем относительный путь (Nginx проксирует /api на бэкенд)
    return "/api";
  }

  // Fallback для SSR или других случаев
  return "/api";
};
