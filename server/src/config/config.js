import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Путь к .env в корне проекта (рядом с server/)
const envPath = path.resolve(__dirname, "../../.env");
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("[config] Failed to load .env from", envPath, result.error.message);
}

function parseVkAppIds() {
  const fromList = (process.env.VK_ID_APP_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const fromSingle = process.env.VK_ID_APP_ID ? [process.env.VK_ID_APP_ID] : [];
  return Array.from(new Set([...fromList, ...fromSingle]));
}

function parseProviderChain() {
  const fromChain = (process.env.LLM_PROVIDER_CHAIN || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const singleProvider = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  const fallback = "heuristic";
  const raw = fromChain.length > 0 ? fromChain : singleProvider ? [singleProvider] : [fallback];
  const withFallback = raw.includes(fallback) ? raw : [...raw, fallback];
  return Array.from(new Set(withFallback));
}

function parseEnabledProviders() {
  const raw = (process.env.LLM_ENABLED_PROVIDERS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return raw.length > 0 ? raw : null;
}

const vkAppIds = parseVkAppIds();
const llmProviderChain = parseProviderChain();
const llmEnabledProviders = parseEnabledProviders();

export default {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || "30d",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  vkId: {
    appId: vkAppIds[0] || null,
    appIds: vkAppIds,
  },
  llm: {
    provider: llmProviderChain[0] || "heuristic",
    providerChain: llmProviderChain,
    enabledProviders: llmEnabledProviders,
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "",
    baseUrl: process.env.LLM_BASE_URL || "",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 12000),
    gpt4free: {
      baseUrl: process.env.GPT4FREE_BASE_URL || "http://localhost:1337/v1",
      apiKey: process.env.GPT4FREE_API_KEY || "",
      model: process.env.GPT4FREE_MODEL || "gpt-4o-mini",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "",
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      flashLiteModel: process.env.GEMINI_FLASH_LITE_MODEL || "gemini-2.0-flash-lite",
    },
    gigaChat: {
      authKey: process.env.GIGACHAT_AUTH_KEY || "",
      scope: process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS",
      model: process.env.GIGACHAT_MODEL || "GigaChat-2",
      allowInsecureTls: String(process.env.GIGACHAT_ALLOW_INSECURE_TLS || "").toLowerCase() === "true",
      authUrl:
        process.env.GIGACHAT_AUTH_URL ||
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      baseUrl:
        process.env.GIGACHAT_BASE_URL ||
        "https://gigachat.devices.sberbank.ru/api/v1",
    },
  },
};
