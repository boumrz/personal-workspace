import express from "express";
import asyncHandler from "express-async-handler";
import pool from "../../database/db.js";
import config from "../../config/config.js";
import { authenticateToken } from "../../middleware/auth.js";
import { parseTransactionsFromSpeech } from "../../services/transactionSpeechParser.js";

const router = express.Router();

const ALL_PROVIDERS = [
  { id: "gigachat", label: "GigaChat", model: "GigaChat" },
  { id: "gpt4free", label: "GPT4Free", model: "gpt-4o-mini" },
  { id: "gemini", label: "Gemini", model: "gemini-2.0-flash" },
  { id: "gemini-flash-lite", label: "Gemini Flash Lite", model: "gemini-2.0-flash-lite" },
  { id: "openrouter", label: "OpenRouter", model: "various" },
  { id: "groq", label: "Groq", model: "llama-3.1-8b-instant" },
  { id: "heuristic", label: "Эвристика (fallback)", model: null },
];

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
    const normalizedText = typeof text === "string" ? text.trim() : "";

    if (!normalizedText) {
      return res.status(400).json({ error: "Field 'text' is required" });
    }

    if (mode !== "actual" && mode !== "planned") {
      return res.status(400).json({ error: "Field 'mode' must be 'actual' or 'planned'" });
    }

    const invalidProvider =
      provider !== undefined && typeof provider !== "string";
    const invalidProviderChain =
      providerChain !== undefined &&
      (!Array.isArray(providerChain) || providerChain.some((item) => typeof item !== "string"));
    if (invalidProvider || invalidProviderChain) {
      return res.status(400).json({ error: "Fields 'provider'/'providerChain' must be string and string[]" });
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
      timezone: context?.timezone,
      providers: providerChain?.length ? providerChain : provider ? [provider] : undefined,
      userOverride,
    });

    res.json({
      items: parsed.items,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
      unparsedText: parsed.unparsedText,
    });
  })
);

export default router;
