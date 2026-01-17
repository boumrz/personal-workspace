// Service Worker для PWA с принудительным обновлением
// Версия кеша - обновляется при каждом деплое
const CACHE_VERSION = "v" + Date.now();
const CACHE_NAME = `finance-assistant-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `finance-assistant-static-${CACHE_VERSION}`;

// Стратегия кеширования: Network First для всех ресурсов - всегда проверяем обновления
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...", CACHE_VERSION);
  // Принудительно активируем новый Service Worker сразу
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...", CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Удаляем все старые кеши
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName !== CACHE_NAME &&
              cacheName !== STATIC_CACHE_NAME &&
              cacheName.startsWith("finance-assistant-")
            );
          })
          .map((cacheName) => {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  // Немедленно берем контроль над всеми клиентами
  return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Для API запросов - только сеть, без кеширования
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Для всех остальных запросов используем Network First - всегда проверяем обновления
  // Кеш используется только как fallback при отсутствии сети
  event.respondWith(
    fetch(request, {
      cache: "no-cache", // Не используем HTTP кеш браузера
    })
      .then((response) => {
        // Если получили ответ, обновляем кеш для offline использования
        if (response.status === 200 && request.method === "GET") {
          const responseClone = response.clone();
          const cacheToUse = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$/) 
            ? STATIC_CACHE_NAME 
            : CACHE_NAME;
          caches.open(cacheToUse).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Если сеть недоступна, используем кеш как fallback
        return caches.match(request);
      })
  );
});

// Обработка сообщений от клиента для принудительного обновления
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHE") {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    });
  }
});
