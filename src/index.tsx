import React from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";
import App from "./App";
import "./index.css";

// Регистрация Service Worker для PWA с проверкой обновлений
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", {
        updateViaCache: "none", // Всегда проверяем обновления
      })
      .then((registration) => {
        console.log("Service Worker зарегистрирован:", registration);

        // Проверяем обновления каждые 30 секунд для более быстрого обнаружения обновлений
        setInterval(() => {
          registration.update();
        }, 30000);

        // Обработка обновления Service Worker
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Новый Service Worker установлен, но старый еще активен
                // Принудительно активируем новый
                console.log("Новая версия доступна, обновляем...");
                newWorker.postMessage({ type: "SKIP_WAITING" });
                // Перезагружаем страницу для применения обновлений
                window.location.reload();
              }
            });
          }
        });

        // Обработка контроллера (когда Service Worker берет контроль)
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      })
      .catch((error) => {
        console.log("Ошибка регистрации Service Worker:", error);
      });
  });
}

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
