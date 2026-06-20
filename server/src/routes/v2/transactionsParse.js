import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../../database/db.js";
import config from "../../config/config.js";
import { authenticateToken } from "../../middleware/auth.js";
import { parseTransactionsFromSpeech } from "../../services/transactionSpeechParser.js";
import { parseMultipartForm } from "../../services/multipartFormParser.js";
import {
  buildExcelWorkbookXlsx,
  buildImportPreview,
  buildReceiptPreview,
} from "../../services/transactionsDataTools.js";

const router = express.Router();

const MAX_VOICE_TEXT_LENGTH = 500;
const MAX_PARSED_ITEMS = 10;
const MAX_PROVIDER_CHAIN_LENGTH = 5;
const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const SAFE_TIMEZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;
const SAFE_LOCALE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8}){0,2}$/;
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_REQUEST_KEYS = new Set(["text", "mode", "context", "provider", "providerChain"]);
const ALLOWED_CONTEXT_KEYS = new Set(["timezone", "locale"]);
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

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyAllowedKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function sanitizeDateValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;
  if (ISO_DATE_PATTERN.test(normalized)) return normalized;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(
    2,
    "0"
  )}`;
}

function normalizeScope(rawScope) {
  const scope = String(rawScope || "all").trim().toLowerCase();
  if (scope === "actual" || scope === "planned" || scope === "all") return scope;
  return null;
}

async function loadUserCategories(userId) {
  const categoriesResult = await pool.query(
    "SELECT id, name, color, icon, type FROM categories WHERE user_id = $1 ORDER BY id ASC",
    [userId]
  );
  return categoriesResult.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    color: row.color,
    icon: row.icon,
    type: row.type || (row.name === "Зарплата" ? "income" : row.name === "Другое" ? "both" : "expense"),
  }));
}

async function loadTransactionsForExport(userId, scope) {
  const result = [];
  if (scope === "all" || scope === "actual") {
    const transactionsResult = await pool.query(
      `
      SELECT
        t.id,
        t.type,
        t.amount,
        t.description,
        t.date,
        c.id AS category_id,
        c.name AS category_name,
        c.color AS category_color,
        c.icon AS category_icon,
        c.type AS category_type
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = $1
      ORDER BY t.date DESC, t.created_at DESC
    `,
      [userId]
    );

    result.push(
      ...transactionsResult.rows.map((row) => ({
        mode: "actual",
        type: row.type === "income" ? "income" : "expense",
        amount: Number(row.amount) || 0,
        description: row.description || "",
        date: sanitizeDateValue(row.date) || "",
        category: {
          id: String(row.category_id),
          name: row.category_name || "",
          color: row.category_color || "",
          icon: row.category_icon || "",
          type: row.category_type || (row.category_name === "Зарплата" ? "income" : row.category_name === "Другое" ? "both" : "expense"),
        },
      }))
    );
  }

  if (scope === "all" || scope === "planned") {
    const plannedResult = await pool.query(
      `
      SELECT
        pe.id,
        pe.amount,
        pe.description,
        pe.date,
        c.id AS category_id,
        c.name AS category_name,
        c.color AS category_color,
        c.icon AS category_icon,
        c.type AS category_type
      FROM planned_expenses pe
      JOIN categories c ON c.id = pe.category_id
      WHERE pe.user_id = $1
      ORDER BY pe.date DESC, pe.created_at DESC
    `,
      [userId]
    );

    result.push(
      ...plannedResult.rows.map((row) => ({
        mode: "planned",
        type: "expense",
        amount: Number(row.amount) || 0,
        description: row.description || "",
        date: sanitizeDateValue(row.date) || "",
        category: {
          id: String(row.category_id),
          name: row.category_name || "",
          color: row.category_color || "",
          icon: row.category_icon || "",
          type: row.category_type || (row.category_name === "Другое" ? "both" : "expense"),
        },
      }))
    );
  }

  return result;
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

router.all(
  "/export",
  asyncHandler(async (req, res) => {
    const scope = normalizeScope(req.method === "GET" ? req.query?.scope : req.body?.scope);
    if (!scope) {
      return res.status(400).json({ error: "Field 'scope' must be one of: all, actual, planned." });
    }

    const userId = req.user.userId;
    const transactions = await loadTransactionsForExport(userId, scope);
    const workbook = buildExcelWorkbookXlsx({
      transactions,
      scopeLabel: scope,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `finance-assistant-${scope}-${stamp}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.status(200).send(workbook);
  })
);

router.post(
  "/import",
  asyncHandler(async (req, res) => {
    try {
      const { fields, files } = await parseMultipartForm(req, {
        maxBytes: MAX_IMPORT_FILE_BYTES,
      });
      const file = files.file;
      if (!file) {
        return res.status(400).json({ error: "Field 'file' is required for import." });
      }

      const targetMode = String(fields.targetMode || "actual").toLowerCase() === "planned" ? "planned" : "actual";
      const timezone =
        typeof fields.timezone === "string" && SAFE_TIMEZONE_PATTERN.test(fields.timezone.trim())
          ? fields.timezone.trim()
          : "Europe/Moscow";
      const categories = await loadUserCategories(req.user.userId);
      const preview = await buildImportPreview({
        file,
        targetMode,
        categories,
        timezone,
      });

      res.json({
        items: preview.drafts,
        warnings: preview.warnings,
        confidence: preview.drafts.length > 0 ? 0.74 : 0.2,
        unparsedText: "",
        preview,
      });
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 400;
      return res.status(statusCode).json({ error: String(error?.message || "Import parsing failed.") });
    }
  })
);

router.post(
  "/receipt/parse",
  asyncHandler(async (req, res) => {
    try {
      const { fields, files } = await parseMultipartForm(req, {
        maxBytes: MAX_IMPORT_FILE_BYTES,
      });
      const image = files.image || files.file;
      if (!image) {
        return res.status(400).json({ error: "Image file is required. Use field 'image' or 'file'." });
      }
      if (!String(image.mimeType || "").toLowerCase().startsWith("image/")) {
        return res.status(400).json({ error: "Uploaded file must be an image." });
      }

      const timezone =
        typeof fields.timezone === "string" && SAFE_TIMEZONE_PATTERN.test(fields.timezone.trim())
          ? fields.timezone.trim()
          : "Europe/Moscow";
      const preview = await buildReceiptPreview({
        imageFile: image,
        timezone,
      });

      res.json({
        items: preview.drafts,
        warnings: preview.warnings,
        confidence: preview.drafts.length > 0 ? 0.7 : 0.2,
        unparsedText: "",
        preview,
      });
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 400;
      return res.status(statusCode).json({ error: String(error?.message || "Receipt parsing failed.") });
    }
  })
);

router.post(
  "/parse",
  asyncHandler(async (req, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: "Request body must be a JSON object." });
    }

    if (!hasOnlyAllowedKeys(req.body, ALLOWED_REQUEST_KEYS)) {
      return res.status(400).json({
        error: "Request contains unsupported fields. Allowed fields: text, mode, context, provider, providerChain.",
      });
    }

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

    if (context !== undefined) {
      if (!isPlainObject(context)) {
        return res.status(400).json({ error: "Field 'context' must be an object." });
      }
      if (!hasOnlyAllowedKeys(context, ALLOWED_CONTEXT_KEYS)) {
        return res.status(400).json({ error: "Field 'context' supports only 'timezone' and 'locale'." });
      }
      if (
        context.timezone !== undefined &&
        (typeof context.timezone !== "string" || !SAFE_TIMEZONE_PATTERN.test(context.timezone.trim()))
      ) {
        return res.status(400).json({ error: "Field 'context.timezone' has invalid format." });
      }
      if (
        context.locale !== undefined &&
        (typeof context.locale !== "string" || !SAFE_LOCALE_PATTERN.test(context.locale.trim()))
      ) {
        return res.status(400).json({ error: "Field 'context.locale' has invalid format." });
      }
    }

    if (provider !== undefined && (typeof provider !== "string" || provider.length > 32)) {
      return res.status(400).json({ error: "Field 'provider' must be a string up to 32 characters." });
    }

    if (providerChain !== undefined) {
      if (!Array.isArray(providerChain)) {
        return res.status(400).json({ error: "Field 'providerChain' must be an array of provider ids." });
      }
      if (providerChain.length === 0 || providerChain.length > MAX_PROVIDER_CHAIN_LENGTH) {
        return res.status(400).json({
          error: `Field 'providerChain' must contain from 1 to ${MAX_PROVIDER_CHAIN_LENGTH} provider ids.`,
        });
      }
      const hasInvalidItem = providerChain.some(
        (item) => typeof item !== "string" || normalizeProviderId(item).length === 0 || String(item).length > 32
      );
      if (hasInvalidItem) {
        return res.status(400).json({
          error: "Field 'providerChain' must contain non-empty provider ids up to 32 characters each.",
        });
      }
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

    const categories = await loadUserCategories(userId);

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
        const date = sanitizeDateValue(item?.date);
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
          date,
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
