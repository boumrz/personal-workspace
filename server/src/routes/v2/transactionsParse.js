import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../../database/db.js";
import config from "../../config/config.js";
import { authenticateToken } from "../../middleware/auth.js";
import { parseTransactionsFromSpeech } from "../../services/transactionSpeechParser.js";

const router = express.Router();

const MAX_VOICE_TEXT_LENGTH = 500;
const MAX_PARSED_ITEMS = 10;
const SAFE_TIMEZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const PROMPT_INJECTION_PATTERN =
  /(```|<script|<\/script>|\b(?:ignore|forget)\b.{0,30}\b(?:instruction|system|prompt)\b|\b(?:drop|truncate|alter|delete|insert|update|create)\b.{0,20}\b(?:table|database|schema)\b)/i;
const NON_TRANSACTION_QUESTION_PATTERN =
  /[?？]|\b(?:кто|что|почему|зачем|объясни|расскажи|анекдот|новост|погода)\b/i;
const TRANSACTION_INTENT_PATTERN =
  /\b(?:потрат|купил|заплат|доход|расход|оплат|получил|зарплат|кэшб[еэ]к|кешб[еэ]к|вернул|перев[её]л|трат[аы]|доходы?)\b/i;
const SUPPORTED_PROVIDER_IDS = new Set([
  "gigachat",
  "gpt4free",
  "gemini",
  "gemini-flash-lite",
  "openrouter",
  "groq",
  "heuristic",
]);

const ALL_PROVIDERS = [
  { id: "gigachat", label: "GigaChat", model: "GigaChat" },
  { id: "gpt4free", label: "GPT4Free", model: "gpt-4o-mini" },
  { id: "gemini", label: "Gemini", model: "gemini-2.0-flash" },
  { id: "gemini-flash-lite", label: "Gemini Flash Lite", model: "gemini-2.0-flash-lite" },
  { id: "openrouter", label: "OpenRouter", model: "various" },
  { id: "groq", label: "Groq", model: "llama-3.1-8b-instant" },
  { id: "heuristic", label: "Эвристика (fallback)", model: null },
];

function sanitizeVoiceText(raw) {
  return String(raw || "")
    .replace(CONTROL_CHARS_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCategoryHint(value) {
  const cleaned = String(value || "")
    .replace(CONTROL_CHARS_PATTERN, " ")
    .replace(/[<>`{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 64);
}

function isLikelyTransactionText(text) {
  const normalized = text.toLowerCase();
  const hasAmount = /\d/.test(normalized);
  const hasLetters = /[a-zа-я]/i.test(normalized);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const hasShortPhrase = tokens.length >= 2 && tokens.length <= 16;
  return hasAmount && hasLetters && (TRANSACTION_INTENT_PATTERN.test(normalized) || hasShortPhrase);
}

function normalizeProviderId(providerId) {
  return String(providerId || "").trim().toLowerCase();
}

router.use(authenticateToken);

router.get(
  "/llm-options",
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const userResult = await pool.query(
      "SELECT voice_llm_provider, voice_llm_provider_chain, voice_llm_enabled_providers FROM users WHERE id = $1",
      [userId]
    );
    const user = userResult.rows[0];
    const userEnabled = user?.voice_llm_enabled_providers
      ? user.voice_llm_enabled_providers.split(",").map((p) => p.trim()).filter(Boolean)
      : null;
    const globalEnabled = config.llm.enabledProviders;
    const providers = userEnabled?.length
      ? ALL_PROVIDERS.filter((p) => userEnabled.includes(p.id))
      : globalEnabled
        ? ALL_PROVIDERS.filter((p) => globalEnabled.includes(p.id))
        : ALL_PROVIDERS;
    res.json({
      providers,
      defaultChain: config.llm.providerChain,
      userPreference: {
        provider: user?.voice_llm_provider || null,
        providerChain: user?.voice_llm_provider_chain
          ? user.voice_llm_provider_chain.split(",").map((p) => p.trim()).filter(Boolean)
          : null,
        enabledProviders: user?.voice_llm_enabled_providers
          ? user.voice_llm_enabled_providers.split(",").map((p) => p.trim()).filter(Boolean)
          : null,
      },
    });
  })
);

router.post(
  "/parse",
  asyncHandler(async (req, res) => {
    const { text, mode = "actual", context, provider, providerChain } = req.body ?? {};
    const userId = req.user.userId;
    const normalizedText = sanitizeVoiceText(text);

    if (!normalizedText) {
      return res.status(400).json({ error: "Field 'text' is required" });
    }

    if (normalizedText.length > MAX_VOICE_TEXT_LENGTH) {
      return res
        .status(400)
        .json({ error: `Field 'text' is too long. Max length is ${MAX_VOICE_TEXT_LENGTH} characters.` });
    }

    if (PROMPT_INJECTION_PATTERN.test(normalizedText)) {
      return res.status(400).json({ error: "Invalid text format for voice parsing." });
    }

    if (NON_TRANSACTION_QUESTION_PATTERN.test(normalizedText)) {
      return res
        .status(400)
        .json({ error: "Voice parser accepts only transaction phrases with amount and category." });
    }

    if (!isLikelyTransactionText(normalizedText)) {
      return res
        .status(400)
        .json({ error: "Voice parser accepts only valid transaction text with amount and category." });
    }

    if (mode !== "actual" && mode !== "planned") {
      return res.status(400).json({ error: "Field 'mode' must be 'actual' or 'planned'" });
    }

    const normalizedProvider = provider !== undefined ? normalizeProviderId(provider) : undefined;
    const normalizedProviderChain =
      providerChain !== undefined
        ? Array.isArray(providerChain)
          ? providerChain.map((item) => normalizeProviderId(item))
          : null
        : undefined;

    const invalidProvider =
      normalizedProvider !== undefined && !SUPPORTED_PROVIDER_IDS.has(normalizedProvider);
    const invalidProviderChain =
      normalizedProviderChain !== undefined &&
      (!Array.isArray(normalizedProviderChain) ||
        normalizedProviderChain.some((item) => !SUPPORTED_PROVIDER_IDS.has(item)));

    if (invalidProvider || invalidProviderChain) {
      return res.status(400).json({
        error: "Fields 'provider'/'providerChain' must contain only supported provider ids.",
      });
    }

    const categoriesResult = await pool.query(
      "SELECT id, name, color, icon FROM categories WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );

    const categories = categoriesResult.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      color: row.color,
      icon: row.icon,
    }));

    const userLlmResult = await pool.query(
      "SELECT voice_llm_provider, voice_llm_provider_chain, voice_llm_enabled_providers FROM users WHERE id = $1",
      [userId]
    );
    const userRow = userLlmResult.rows[0];
    const hasLlmSettings =
      userRow?.voice_llm_provider ||
      userRow?.voice_llm_provider_chain ||
      userRow?.voice_llm_enabled_providers;
    const userOverride = hasLlmSettings
      ? {
          provider: userRow?.voice_llm_provider || undefined,
          providerChain: userRow?.voice_llm_provider_chain
            ? userRow.voice_llm_provider_chain.split(",").map((p) => p.trim()).filter(Boolean)
            : undefined,
          enabledProviders: userRow?.voice_llm_enabled_providers
            ? userRow.voice_llm_enabled_providers.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean)
            : undefined,
        }
      : undefined;

    const parsed = await parseTransactionsFromSpeech({
      text: normalizedText,
      mode,
      categories,
      timezone:
        typeof context?.timezone === "string" && SAFE_TIMEZONE_PATTERN.test(context.timezone.trim())
          ? context.timezone.trim()
          : undefined,
      providers:
        normalizedProviderChain?.length
          ? normalizedProviderChain
          : normalizedProvider
            ? [normalizedProvider]
            : undefined,
      userOverride,
    });

    const parsedItems = Array.isArray(parsed.items) ? parsed.items : [];
    const safeItems = parsedItems
      .map((item) => {
        const amount = Number(item?.amount);
        if (!Number.isFinite(amount) || amount <= 0) return null;

        const categoryHint = sanitizeCategoryHint(item?.categoryHint);
        const suggestedCategoryToCreate = sanitizeCategoryHint(item?.suggestedCategoryToCreate);
        const categoryResolution =
          item?.categoryResolution === "matched_existing" ||
          item?.categoryResolution === "suggest_create" ||
          item?.categoryResolution === "unknown"
            ? item.categoryResolution
            : categoryHint
              ? "unknown"
              : "suggest_create";

        return {
          type: item?.type === "income" ? "income" : "expense",
          amount: Math.round(amount * 100) / 100,
          categoryHint,
          categoryResolution,
          suggestedCategoryToCreate:
            suggestedCategoryToCreate && suggestedCategoryToCreate !== categoryHint
              ? suggestedCategoryToCreate
              : undefined,
        };
      })
      .filter(Boolean)
      .slice(0, MAX_PARSED_ITEMS);

    const safeWarnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
      .map((warning) => String(warning).replace(CONTROL_CHARS_PATTERN, " ").trim())
      .filter(Boolean)
      .slice(0, 5);

    if (parsedItems.length > MAX_PARSED_ITEMS) {
      safeWarnings.push(`Too many operations in one request. Only first ${MAX_PARSED_ITEMS} were kept.`);
    }

    res.json({
      items: safeItems,
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
      warnings: safeWarnings,
      unparsedText: typeof parsed.unparsedText === "string" ? parsed.unparsedText.slice(0, 160) : "",
    });
  })
);

export default router;
