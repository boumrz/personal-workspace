import { Alert, Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Buffer } from "buffer";
import type { TransactionImportPreview } from "@finance-assistant/shared";
import { APP_DEEP_LINK_SCHEME, DATA_TOOL_ENDPOINTS } from "../constants/config";

type OpenNativeToolArgs = {
  title: string;
  body: string;
};

type WebUploadArgs = {
  endpoint: string;
  accept: string;
  capture?: string;
  fieldName: string;
  title: string;
  kind: "excel" | "receipt";
  apiBaseUrl: string;
  token: string;
};

function htmlEscape(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDataUrl(html: string) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export function encodePreviewPayload(preview: TransactionImportPreview) {
  return Buffer.from(JSON.stringify(preview), "utf8").toString("base64");
}

export function decodePreviewPayload(payload: string): TransactionImportPreview | null {
  if (!payload) return null;
  try {
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json) as TransactionImportPreview;
  } catch {
    return null;
  }
}

export function parseImportDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith(`${APP_DEEP_LINK_SCHEME}:`)) {
      return null;
    }

    const type = (parsed.hostname || parsed.pathname.replace(/^\//, "")).trim();
    if (type !== "import") {
      return null;
    }

    const kind = parsed.searchParams.get("kind");
    const payload = parsed.searchParams.get("payload");
    if (!payload) {
      return null;
    }

    const preview = decodePreviewPayload(payload);
    if (!preview) {
      return null;
    }

    return {
      kind: kind === "receipt" ? "receipt" : "excel",
      preview,
    } as const;
  } catch {
    return null;
  }
}

function buildSuccessCallbackUrl(kind: "excel" | "receipt", payload: string) {
  return `${APP_DEEP_LINK_SCHEME}://import?kind=${encodeURIComponent(kind)}&payload=${encodeURIComponent(payload)}`;
}

function buildUploadPageHtml({
  endpoint,
  accept,
  capture,
  fieldName,
  title,
  kind,
  apiBaseUrl,
  token,
}: WebUploadArgs) {
  const callbackPrefix = `${APP_DEEP_LINK_SCHEME}://import`;
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #10172a 0%, #181f36 100%);
        color: #f5f7ff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      }
      .card {
        width: min(100%, 420px);
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 24px;
        padding: 20px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.35);
        backdrop-filter: blur(18px);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0 0 16px;
        color: rgba(245,247,255,0.78);
        line-height: 1.5;
      }
      .drop {
        border: 1.5px dashed rgba(255,255,255,0.28);
        border-radius: 20px;
        padding: 18px;
        margin: 14px 0;
        background: rgba(255,255,255,0.04);
      }
      input[type="file"] {
        width: 100%;
        color: rgba(245,247,255,0.92);
      }
      button, a.button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, #4f8cff, #68d2ff);
        color: #07111f;
        font-weight: 700;
        padding: 14px 18px;
        width: 100%;
        margin-top: 14px;
        text-align: center;
        display: inline-block;
        text-decoration: none;
      }
      button:disabled {
        opacity: 0.6;
      }
      .muted {
        font-size: 12px;
        color: rgba(245,247,255,0.62);
        margin-top: 10px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: rgba(0,0,0,0.24);
        padding: 12px;
        border-radius: 16px;
        color: rgba(245,247,255,0.9);
        max-height: 240px;
        overflow: auto;
      }
      .status {
        margin-top: 12px;
        font-size: 14px;
        color: rgba(245,247,255,0.84);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${htmlEscape(title)}</h1>
      <p>${kind === "receipt"
        ? "Загрузите фото чека. Браузер отправит его на сервер и вернёт результат в приложение."
        : "Загрузите Excel/CSV файл. После обработки вы вернётесь в приложение на экран проверки."}</p>
      <div class="drop">
        <input id="file" type="file" accept="${htmlEscape(accept)}"${capture ? ` capture="${htmlEscape(capture)}"` : ""} />
      </div>
      <button id="upload">Загрузить и обработать</button>
      <div id="status" class="status"></div>
      <div class="muted">Если страница не вернулась в приложение автоматически, нажмите кнопку ниже после обработки.</div>
      <a id="back" class="button" style="display:none" href="${callbackPrefix}">Вернуться в приложение</a>
      <pre id="result" style="display:none"></pre>
    </div>
    <script>
      const apiBaseUrl = ${JSON.stringify(apiBaseUrl.replace(/\/$/, ""))};
      const token = ${JSON.stringify(token)};
      const endpoint = ${JSON.stringify(endpoint)};
      const kind = ${JSON.stringify(kind)};
      const fieldName = ${JSON.stringify(fieldName)};
      const statusEl = document.getElementById("status");
      const resultEl = document.getElementById("result");
      const backEl = document.getElementById("back");
      const fileInput = document.getElementById("file");
      const uploadBtn = document.getElementById("upload");

      function b64(value) {
        return btoa(unescape(encodeURIComponent(value)));
      }

      async function uploadFile() {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          statusEl.textContent = "Выберите файл сначала.";
          return;
        }
        uploadBtn.disabled = true;
        statusEl.textContent = "Отправляем файл на сервер...";
        const formData = new FormData();
        formData.append(fieldName, file);
        const response = await fetch(apiBaseUrl + endpoint, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
          },
          body: formData,
        });
        const text = await response.text();
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (error) {
          throw new Error("Сервер вернул не-JSON ответ: " + text.slice(0, 120));
        }
        if (!response.ok) {
          throw new Error(parsed && (parsed.error || parsed.message) ? (parsed.error || parsed.message) : "Ошибка загрузки");
        }
        const preview = parsed && parsed.preview ? parsed.preview : parsed;
        const payload = b64(JSON.stringify(preview));
        const callbackUrl = ${JSON.stringify(callbackPrefix)} + "?kind=" + encodeURIComponent(kind) + "&payload=" + encodeURIComponent(payload);
        statusEl.textContent = "Готово. Возвращаемся в приложение...";
        resultEl.style.display = "block";
        resultEl.textContent = JSON.stringify(preview, null, 2);
        backEl.href = callbackUrl;
        backEl.style.display = "inline-block";
        window.location.href = callbackUrl;
      }

      uploadBtn.addEventListener("click", () => {
        uploadFile().catch((error) => {
          statusEl.textContent = error && error.message ? error.message : "Не удалось загрузить файл.";
          uploadBtn.disabled = false;
        });
      });
    </script>
  </body>
</html>`;
}

function buildExportPageHtml({ apiBaseUrl, token }: { apiBaseUrl: string; token: string }) {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Экспорт в Excel</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #1a1f33, #0d1220);
        color: #f5f7ff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      }
      .card {
        width: min(100%, 420px);
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 24px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 24px 80px rgba(0,0,0,0.35);
        backdrop-filter: blur(18px);
      }
      .spinner {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 4px solid rgba(255,255,255,0.18);
        border-top-color: #68d2ff;
        margin: 14px auto 0;
        animation: spin 1s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      p { color: rgba(245,247,255,0.78); line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Экспорт операций</h1>
      <p>Файл Excel будет сформирован и загружен в браузере автоматически.</p>
      <div class="spinner"></div>
    </div>
    <script>
      (async () => {
        const authToken = ${JSON.stringify(token)};
        const response = await fetch(${JSON.stringify(apiBaseUrl.replace(/\/$/, ""))} + ${JSON.stringify(DATA_TOOL_ENDPOINTS.exportExcel)}, {
          headers: { Authorization: "Bearer " + authToken },
        });
        if (!response.ok) {
          throw new Error("Export failed: " + response.status);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "finance-assistant-export.xlsx";
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          window.close();
        }, 1500);
      })().catch((error) => {
        document.body.innerHTML = "<pre style='white-space:pre-wrap;padding:20px;color:#fff'>" + String(error && error.message ? error.message : error) + "</pre>";
      });
    </script>
  </body>
</html>`;
}

async function openNativeToolPage({ title, body }: OpenNativeToolArgs) {
  const url = toDataUrl(body);
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(title, "Не удалось открыть системный браузер для этой операции.");
    }
  }
}

export async function openExcelExportFlow(apiBaseUrl: string, token: string) {
  if (Platform.OS === "web") {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${DATA_TOOL_ENDPOINTS.exportExcel}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finance-assistant-export.xlsx";
    anchor.click();
    window.URL.revokeObjectURL(url);
    return;
  }

  await openNativeToolPage({
    title: "Экспорт в Excel",
    body: buildExportPageHtml({ apiBaseUrl, token }),
  });
}

export async function openExcelImportFlow(apiBaseUrl: string, token: string) {
  if (Platform.OS === "web") {
    return new Promise<TransactionImportPreview | null>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls,.csv";
      input.oncancel = () => resolve(null);
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${DATA_TOOL_ENDPOINTS.importExcel}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || data?.message || "Import failed");
          }
          resolve((data.preview ?? data) as TransactionImportPreview);
        } catch (error) {
          reject(error);
        }
      };
      input.click();
    });
  }

  await openNativeToolPage({
    title: "Импорт из Excel",
    body: buildUploadPageHtml({
      endpoint: DATA_TOOL_ENDPOINTS.importExcel,
      accept: ".xlsx,.xls,.csv",
      fieldName: "file",
      title: "Импорт из Excel",
      kind: "excel",
      apiBaseUrl,
      token,
    }),
  });
}

export async function openReceiptImportFlow(apiBaseUrl: string, token: string, source: "gallery" | "camera" = "gallery") {
  if (Platform.OS === "web") {
    return new Promise<TransactionImportPreview | null>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (source === "camera") {
        input.capture = "environment";
      }
      input.oncancel = () => resolve(null);
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          const formData = new FormData();
          formData.append("image", file);
          const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${DATA_TOOL_ENDPOINTS.parseReceipt}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || data?.message || "Receipt parse failed");
          }
          resolve((data.preview ?? data) as TransactionImportPreview);
        } catch (error) {
          reject(error);
        }
      };
      input.click();
    });
  }

  await openNativeToolPage({
    title: "Фото чека",
    body: buildUploadPageHtml({
      endpoint: DATA_TOOL_ENDPOINTS.parseReceipt,
      accept: "image/*",
      capture: source === "camera" ? "environment" : undefined,
      fieldName: "image",
      title: "Фото чека",
      kind: "receipt",
      apiBaseUrl,
      token,
    }),
  });
}
