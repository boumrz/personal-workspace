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

    const payload = parsed.searchParams.get("payload");
    if (!payload) {
      return null;
    }

    const preview = decodePreviewPayload(payload);
    if (!preview) {
      return null;
    }

    return { preview } as const;
  } catch {
    return null;
  }
}

function buildSuccessCallbackUrl(payload: string) {
  return `${APP_DEEP_LINK_SCHEME}://import?payload=${encodeURIComponent(payload)}`;
}

function buildUploadPageHtml({
  endpoint,
  accept,
  capture,
  fieldName,
  title,
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
      <p>Загрузите фото чека. Браузер отправит его на сервер и вернёт результат в приложение.</p>
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
        const callbackUrl = ${JSON.stringify(callbackPrefix)} + "?payload=" + encodeURIComponent(payload);
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

async function openNativeToolPage({ title, body }: OpenNativeToolArgs) {
  const url = toDataUrl(body);
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(title, "Не удалось открыть системный браузер для этой операции.");
    }
  }
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
      apiBaseUrl,
      token,
    }),
  });
}
