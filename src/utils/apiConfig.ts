// Утилита для определения базового URL API
// - В разработке (localhost:3000) используется http://localhost:3001/api
// - В продакшене на собственном домене используется относительный путь /api (Nginx проксирует на бэкенд)
// - На GitHub Pages используется полный URL к API серверу (из переменной окружения или из __API_BASE_URL__)
export const getApiBaseUrl = (): string => {
  // Если в процессе сборки была установлена переменная окружения VITE_API_URL,
  // она будет доступна через __API_BASE_URL__ (определяется в rspack.config.cjs)
  if (typeof window !== "undefined") {
    // Проверяем, была ли установлена переменная при сборке
    const apiUrlFromBuild = (window as any).__API_BASE_URL__;
    if (apiUrlFromBuild) {
      return apiUrlFromBuild;
    }

    const hostname = window.location.hostname;

    // Для localhost используем прямой доступ к бэкенду
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001/api";
    }

    // Для GitHub Pages (github.io) используем полный URL к API серверу
    // По умолчанию используем домен из window.location (предполагаем, что API на том же домене)
    if (hostname.includes("github.io")) {
      // Если используется GitHub Pages, API должен быть на другом домене
      // Это должно быть настроено через VITE_API_URL при сборке
      // Иначе возвращаем относительный путь (может не работать, если API на другом домене)
      return "/api";
    }

    // Для продакшена на собственном домене используем относительный путь (Nginx проксирует /api на бэкенд)
    return "/api";
  }

  // Fallback для SSR или других случаев
  return "/api";
};
