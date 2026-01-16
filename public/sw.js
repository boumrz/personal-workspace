// Service Worker для PWA с принудительным обновлением
// Версия кеша - обновляется при каждом деплое
const CACHE_VERSION = "v" + Date.now();
const CACHE_NAME = `finance-assistant-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `finance-assistant-static-${CACHE_VERSION}`;

// Файлы, которые нужно кешировать при установке
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Стратегия кеширования: Network First для HTML, Cache First для статики
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...", CACHE_NAME);
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Принудительно активируем новый Service Worker
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

  // Для HTML файлов используем Network First - всегда проверяем обновления
  if (request.method === "GET" && request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Если получили ответ, обновляем кеш
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Если сеть недоступна, используем кеш
          return caches.match(request);
        })
    );
    return;
  }

  // Для статических ресурсов (JS, CSS, изображения) используем Cache First
  if (
    request.method === "GET" &&
    (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$/) ||
      url.pathname.startsWith("/assets/"))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // Кешируем только успешные ответы
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Для API запросов - только сеть, без кеширования
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Для остальных запросов - Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
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
