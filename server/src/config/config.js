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

const vkAppIds = parseVkAppIds();

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
};
