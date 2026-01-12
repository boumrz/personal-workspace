import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Регистрация Service Worker для PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker зарегистрирован:", registration);
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
