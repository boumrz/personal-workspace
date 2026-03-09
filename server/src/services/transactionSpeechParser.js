import config from "../config/config.js";
import crypto from "crypto";

const DEFAULT_MODEL_BY_PROVIDER = {
  openrouter: "google/gemini-2.0-flash-exp:free",
  groq: "llama-3.1-8b-instant",
  gemini: "gemini-2.0-flash",
  "gemini-flash-lite": "gemini-2.0-flash-lite",
  gigachat: "GigaChat",
  gpt4free: "gpt-4o-mini",
};

const RU_STOPWORDS = new Set([
  "и",
  "или",
  "на",
  "в",
  "во",
  "за",
  "по",
  "для",
  "из",
  "под",
  "над",
  "к",
  "ко",
  "о",
  "об",
  "про",
  "рубль",
  "рублей",
  "рубля",
  "р",
  "рф",
  "штук",
  "штуки",
  "купил",
  "купила",
  "потратил",
  "потратила",
  "взял",
  "взяла",
  "получил",
  "получила",
  "доход",
  "расход",
  "трата",
  "операция",
  "операции",
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Типичные русские окончания существительных/прилагательных — для сопоставления с категориями
const RU_COMMON_ENDINGS = [
  "иями", "ями", "ами", "иях", "иям", "ием", "ого", "ему", "ому", "ыми", "ими",
  "ой", "ий", "ый", "ая", "ое", "ые", "ам", "ям", "ах", "ях", "ов", "ев", "ом", "ем",
  "а", "я", "ы", "и", "е", "у", "ю", "о",
].sort((a, b) => b.length - a.length);

function stemRu(word) {
  const normalized = normalizeText(word);
  if (!normalized) return "";
  return normalized
    .replace(
      new RegExp(`(${RU_COMMON_ENDINGS.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`, "i"),
      ""
    )
    .trim();
}

function stripEnding(word) {
  const normalized = normalizeText(word);
  if (!normalized || normalized.length < 3) return normalized;
  for (const ending of RU_COMMON_ENDINGS) {
    if (ending.length >= normalized.length) continue;
    if (normalized.endsWith(ending)) {
      return normalized.slice(0, -ending.length);
    }
  }
  return normalized;
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function parseAmount(text) {
  const normalized = normalizeText(text)
    .replace(/(\d)\s*,\s*(\d)/g, "$1$2")
    .replace(/\s+/g, " ");

  const match = normalized.match(
    /(\d[\d\s]*(?:[.,]\d+)?)\s*(тысяч(?:а|и)?|тыс|т\.?\s?р|к|миллион(?:а|ов)?|млн|м)?/i
  );
  if (!match) return null;

  const rawNumber = match[1].replace(/\s+/g, "").replace(",", ".");
  const suffix = (match[2] || "").toLowerCase().replace(/\s+/g, "");
  const base = Number(rawNumber);
  if (!Number.isFinite(base) || base <= 0) return null;

  let multiplier = 1;
  if (/^(тыс|тысяч|тысяча|т\.?р|к)$/.test(suffix)) {
    multiplier = 1000;
  } else if (/^(млн|м|миллион|миллиона|миллионов)$/.test(suffix)) {
    multiplier = 1000000;
  }

  const value = base * multiplier;
  return Math.round(value * 100) / 100;
}

function splitUtterance(text) {
  const prepared = String(text || "").replace(/(\d)\s*,\s*(\d)/g, "$1$2");
  return prepared
    .split(/\n|;|,\s+| и потом | затем | потом /gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function detectType(text, mode) {
  const normalized = text.toLowerCase();
  if (mode === "planned") {
    return "expense";
  }
  if (/доход|получил|зарплат|преми|вернули|кэшбек|cashback/.test(normalized)) {
    return "income";
  }
  return "expense";
}

function detectDateHint(text, timezone) {
  const normalized = text.toLowerCase();
  const now = new Date();
  if (/вчера/.test(normalized)) {
    const d = new Date(now);
    d.setDate(now.getDate() - 1);
    return formatIsoDate(d, timezone);
  }
  if (/сегодня/.test(normalized)) {
    return formatIsoDate(now, timezone);
  }
  return null;
}

function formatIsoDate(date, timezone) {
  // Keep output date-only, backend already works with YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone || "Europe/Moscow",
  }).format(date);
}

function cleanupDescription(text, amount) {
  if (!text) return "";
  const amountText = amount ? String(amount).replace(".", "[.,]?") : null;
  const regex = amountText
    ? new RegExp(
        `\\b${amountText}(?:\\s*(тыс(?:яч(?:а|и)?)?|к|млн|миллион(?:а|ов)?))?\\b\\s*(руб(леи|ля|лей)?|₽)?`,
        "gi"
      )
    : null;
  const stripped = regex ? text.replace(regex, " ") : text;
  return stripped
    .replace(/(?:^|\s)\d[\d\s.,]*\s*(тысяч[а-я]*|тыс|млн|миллион[а-я]*|к)\s*(руб(леи|ля|лей)?|₽)?(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)\d[\d\s.,]*\s*(руб(леи|ля|лей)?|₽)?(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)(за|на)?\s*(тысяч[а-я]*|тыс|млн|миллион[а-я]*|к)\s*(руб(леи|ля|лей)?|₽)?(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)(доход|расход|трата|потратил|потратила|получил|получила|добавь|добавить|операция)(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)(тысяч[а-я]*|тыс|млн|миллион[а-я]*|к)(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)(руб(леи|ля|лей)?|р)(?=\s|$)/gi, " ")
    .replace(/(за|на|по|в)\s*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCategoryCandidate(text) {
  const normalized = normalizeText(text);
  const fromPreposition = normalized.match(/\b(?:на|в|за|по|для)\s+([а-яa-z0-9\- ]{2,})$/i);
  if (fromPreposition?.[1]) {
    const candidate = fromPreposition[1]
      .split(" ")
      .filter((token) => token && !RU_STOPWORDS.has(token))
      .slice(0, 3)
      .join(" ")
      .trim();
    if (candidate) return candidate;
  }

  const tokens = tokenize(text);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (!RU_STOPWORDS.has(token) && !/^\d+$/.test(token)) {
      return token;
    }
  }
  return "";
}

function scoreCategoryMatch(chunkTokens, categoryTokens) {
  if (!chunkTokens.length || !categoryTokens.length) return 0;
  let score = 0;
  for (const cToken of categoryTokens) {
    const cStem = stemRu(cToken);
    if (!cStem) continue;
    for (const token of chunkTokens) {
      const tStem = stemRu(token);
      if (!tStem) continue;
      if (tStem === cStem) {
        score = Math.max(score, 1);
      } else if (tStem.includes(cStem) || cStem.includes(tStem)) {
        score = Math.max(score, 0.86);
      } else {
        const distance = levenshtein(tStem, cStem);
        const maxLen = Math.max(tStem.length, cStem.length);
        if (maxLen >= 4 && distance <= 1) {
          score = Math.max(score, 0.82);
        } else if (maxLen >= 6 && distance <= 2) {
          score = Math.max(score, 0.74);
        }
      }
    }
  }
  return score;
}

function matchByEnding(candidate, categories) {
  const normalized = normalizeText(candidate);
  if (!normalized || normalized.length < 2) return null;
  const tokensToCheck = tokenize(candidate).filter((t) => !RU_STOPWORDS.has(t));
  for (const token of tokensToCheck) {
    const base = stripEnding(token);
    if (base === normalizeText(token)) continue;
    for (const category of categories) {
      const catNorm = normalizeText(category.name);
      const catBase = stripEnding(category.name);
      const catStem = stemRu(category.name);
      const candStem = stemRu(token);
      if (
        catNorm === normalizeText(token) ||
        catBase === base ||
        (catStem && candStem && catStem === candStem)
      ) {
        return category.name;
      }
    }
  }
  const base = stripEnding(candidate);
  if (base !== normalized) {
    for (const category of categories) {
      const catNorm = normalizeText(category.name);
      const catBase = stripEnding(category.name);
      const catStem = stemRu(category.name);
      const candStem = stemRu(candidate);
      if (catNorm === normalized || catBase === base || (catStem && candStem && catStem === candStem)) {
        return category.name;
      }
    }
  }
  return null;
}

function findCategoryHint(text, categories) {
  const chunkTokens = tokenize(text).filter((token) => !RU_STOPWORDS.has(token));
  let best = null;

  for (const category of categories) {
    const categoryTokens = tokenize(category.name);
    const score = scoreCategoryMatch(chunkTokens, categoryTokens);
    if (!best || score > best.score) {
      best = { name: category.name, score };
    }
  }

  if (best && best.score >= 0.74) {
    return { hint: best.name, matched: true };
  }

  const candidate = extractCategoryCandidate(text);
  if (candidate) {
    const byEnding = matchByEnding(candidate, categories);
    if (byEnding) {
      return { hint: byEnding, matched: true };
    }
    return { hint: candidate, matched: false };
  }
  return { hint: undefined, matched: false };
}

function heuristicParse({ text, mode, categories, timezone }) {
  const chunks = splitUtterance(text);
  const items = chunks
    .map((chunk) => {
      const amount = parseAmount(chunk);
      if (!amount) return null;
      const categoryInfo = findCategoryHint(chunk, categories);
      return {
        type: detectType(chunk, mode),
        amount,
        description: cleanupDescription(chunk, amount) || "Голосовая операция",
        categoryHint: categoryInfo.hint,
        date: detectDateHint(chunk, timezone),
        confidence: categoryInfo.matched ? 0.62 : 0.52,
      };
    })
    .filter(Boolean);

  const unresolvedCount = items.filter((item) => !item.categoryHint).length;
  return {
    items,
    confidence: items.length > 0 ? 0.58 : 0.2,
    warnings:
      items.length > 0
        ? unresolvedCount > 0
          ? ["Для части операций не удалось определить категорию."]
          : []
        : ["Не удалось выделить операции автоматически."],
    unparsedText: items.length > 0 ? "" : text,
  };
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function repairJson(str) {
  return str
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/\r\n/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}

function extractJson(text) {
  if (!text) return null;
  const raw = text.trim();
  const candidates = [];
  if (raw.startsWith("{") && raw.endsWith("}")) {
    candidates.push(raw);
  }
  const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) {
    candidates.push(blockMatch[1].trim());
  }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0] && !candidates.includes(objectMatch[0])) {
    candidates.push(objectMatch[0]);
  }
  for (const s of candidates) {
    let parsed = tryParseJson(s);
    if (parsed) return parsed;
    parsed = tryParseJson(repairJson(s));
    if (parsed) return parsed;
  }
  return null;
}

function normalizeProvider(provider) {
  return String(provider || "")
    .trim()
    .toLowerCase();
}

function resolveProviderChain(requestedProviders, userOverride) {
  const globalEnabled = config.llm.enabledProviders;
  const userEnabled = userOverride?.enabledProviders;
  const filterByEnabled = (list) => {
    if (userEnabled?.length) {
      return list.filter((p) => userEnabled.includes(p));
    }
    return globalEnabled ? list.filter((p) => globalEnabled.includes(p)) : list;
  };

  let raw = [];
  if (userOverride?.providerChain?.length) {
    raw = userOverride.providerChain.map(normalizeProvider).filter(Boolean);
  } else if (userOverride?.provider) {
    raw = [normalizeProvider(userOverride.provider)];
  } else if (requestedProviders?.length) {
    raw = (Array.isArray(requestedProviders) ? requestedProviders : [requestedProviders])
      .map(normalizeProvider)
      .filter(Boolean);
  }
  if (raw.length === 0) {
    raw = Array.isArray(config.llm.providerChain)
      ? config.llm.providerChain.map(normalizeProvider).filter(Boolean)
      : [normalizeProvider(config.llm.provider || "heuristic")];
  }
  raw = filterByEnabled(raw);
  const withFallback = raw.includes("heuristic") ? raw : [...raw, "heuristic"];
  return Array.from(new Set(withFallback));
}

function logVoiceParse(stage, details = {}) {
  const payload = JSON.stringify(details);
  console.info(`[voice-parse] ${stage} ${payload}`);
}

if (config.llm.gigaChat?.allowInsecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn(
    "[voice-parse] GIGACHAT_ALLOW_INSECURE_TLS=true: TLS certificate validation is disabled (dev-only)."
  );
}

async function callOpenAiCompatible({ baseUrl, apiKey, model, prompt, timeoutMs, skipAuth }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { "Content-Type": "application/json" };
  if (!skipAuth && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You parse Russian finance speech to JSON. Return only JSON object with keys: items, confidence, warnings, unparsedText.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini({ apiKey, model, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

let cachedGigaChatToken = null;
let cachedGigaChatTokenExpiresAt = 0;

async function getGigaChatAccessToken({ timeoutMs }) {
  if (cachedGigaChatToken && Date.now() < cachedGigaChatTokenExpiresAt) {
    return cachedGigaChatToken;
  }

  const authKey = config.llm.gigaChat?.authKey || "";
  const scope = config.llm.gigaChat?.scope || "GIGACHAT_API_PERS";
  const authUrl = config.llm.gigaChat?.authUrl || "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
  if (!authKey) {
    throw new Error("GigaChat auth key is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${authKey}`,
        RqUID: crypto.randomUUID(),
      },
      body: new URLSearchParams({ scope }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GigaChat auth failed: ${response.status}`);
    }
    const data = await response.json();
    const accessToken = String(data?.access_token || "").trim();
    if (!accessToken) {
      throw new Error("GigaChat auth response has no access_token");
    }
    const expiresInMs = Math.max(30_000, Number(data?.expires_in || 0));
    cachedGigaChatToken = accessToken;
    cachedGigaChatTokenExpiresAt = Date.now() + expiresInMs - 30_000;
    return accessToken;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGigaChat({ model, prompt, timeoutMs }) {
  const accessToken = await getGigaChatAccessToken({ timeoutMs });
  const baseUrl = config.llm.gigaChat?.baseUrl || "https://gigachat.devices.sberbank.ru/api/v1";
  const maxRetries = 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          stream: false,
          max_tokens: 1024,
          messages: [
            {
              role: "system",
              content:
                "You parse Russian finance speech to JSON. Return only JSON object with keys: items, confidence, warnings, unparsedText.",
            },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      if (response.ok) {
        clearTimeout(timeout);
        const data = await response.json();
        return data?.choices?.[0]?.message?.content ?? "";
      }
      const errBody = await response.text();
      if (response.status >= 500 && attempt < maxRetries) {
        logVoiceParse("gigachat.retry", {
          attempt: attempt + 1,
          status: response.status,
          body: errBody?.slice(0, 200),
        });
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      lastError = new Error(
        `GigaChat request failed: ${response.status}${errBody ? ` — ${errBody.slice(0, 150)}` : ""}`
      );
    } catch (e) {
      clearTimeout(timeout);
      lastError = e;
      if (attempt < maxRetries) {
        logVoiceParse("gigachat.retry", { attempt: attempt + 1, error: String(e) });
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
    throw lastError;
  }
  throw lastError;
}

async function callProvider({ provider, prompt, timeoutMs }) {
  if (provider === "openrouter") {
    const apiKey = config.llm.apiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key is not configured");
    }
    return callOpenAiCompatible({
      baseUrl: config.llm.baseUrl || "https://openrouter.ai/api/v1",
      apiKey,
      model: config.llm.model || DEFAULT_MODEL_BY_PROVIDER.openrouter,
      prompt,
      timeoutMs,
    });
  }

  if (provider === "groq") {
    const apiKey = config.llm.apiKey;
    if (!apiKey) {
      throw new Error("Groq API key is not configured");
    }
    return callOpenAiCompatible({
      baseUrl: config.llm.baseUrl || "https://api.groq.com/openai/v1",
      apiKey,
      model: config.llm.model || DEFAULT_MODEL_BY_PROVIDER.groq,
      prompt,
      timeoutMs,
    });
  }

  if (provider === "gemini") {
    const apiKey = config.llm.gemini?.apiKey || config.llm.apiKey;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    return callGemini({
      apiKey,
      model: config.llm.gemini?.model || config.llm.model || DEFAULT_MODEL_BY_PROVIDER.gemini,
      prompt,
      timeoutMs,
    });
  }

  if (provider === "gemini-flash-lite") {
    const apiKey = config.llm.gemini?.apiKey || config.llm.apiKey;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    return callGemini({
      apiKey,
      model: config.llm.gemini?.flashLiteModel || DEFAULT_MODEL_BY_PROVIDER["gemini-flash-lite"],
      prompt,
      timeoutMs,
    });
  }

  if (provider === "gpt4free") {
    const baseUrl = config.llm.gpt4free?.baseUrl || "http://localhost:1337/v1";
    const apiKey = config.llm.gpt4free?.apiKey || "";
    return callOpenAiCompatible({
      baseUrl,
      apiKey,
      model: config.llm.gpt4free?.model || DEFAULT_MODEL_BY_PROVIDER.gpt4free,
      prompt,
      timeoutMs,
      skipAuth: !apiKey,
    });
  }

  if (provider === "gigachat") {
    const gigaTimeout = config.llm.gigaChat?.timeoutMs ?? timeoutMs;
    return callGigaChat({
      model: config.llm.gigaChat?.model || DEFAULT_MODEL_BY_PROVIDER.gigachat,
      prompt,
      timeoutMs: gigaTimeout,
    });
  }

  if (provider === "heuristic") {
    throw new Error("Heuristic provider should be handled as local fallback");
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

function normalizeResult(result, fallbackText, categories) {
  const suggestionToTitle = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return trimmed[0].toUpperCase() + trimmed.slice(1);
  };

  const resolveCategoryOutcome = (item, categories) => {
    const fromLlm = String(item?.categoryHint || item?.category || "").trim();
    const createSuggestion =
      String(item?.suggestedCategoryToCreate || item?.categorySuggestion || "").trim();

    const normalizedFromLlm = normalizeText(fromLlm);
    if (normalizedFromLlm) {
      const exact = categories.find((category) => normalizeText(category.name) === normalizedFromLlm);
      if (exact) {
        return {
          categoryHint: exact.name,
          categoryResolution: "matched_existing",
          suggestedCategoryToCreate: undefined,
        };
      }
    }

    // LLM-first strategy:
    // if model did not return exact existing category, treat it as suggestion to create.
    const suggested = suggestionToTitle(
      createSuggestion || fromLlm || extractCategoryCandidate(item?.description || "")
    );
    if (suggested) {
      return {
        categoryHint: suggested,
        categoryResolution: "suggest_create",
        suggestedCategoryToCreate: suggested,
      };
    }

    return {
      categoryHint: undefined,
      categoryResolution: "unknown",
      suggestedCategoryToCreate: undefined,
    };
  };

  const items = Array.isArray(result?.items)
    ? result.items
        .map((item) => {
          const amount = Number(item?.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            return null;
          }
          const type = item?.type === "income" ? "income" : "expense";
          const categoryOutcome = resolveCategoryOutcome(item, categories);
          return {
            type,
            amount: Math.round(amount * 100) / 100,
            description: String(item?.description || "Голосовая операция").trim(),
            categoryHint: categoryOutcome.categoryHint,
            categoryResolution: categoryOutcome.categoryResolution,
            suggestedCategoryToCreate: categoryOutcome.suggestedCategoryToCreate,
            date: item?.date ? String(item.date) : undefined,
            confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : undefined,
          };
        })
        .filter(Boolean)
    : [];

  return {
    items,
    confidence: Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : items.length > 0 ? 0.7 : 0.2,
    warnings: Array.isArray(result?.warnings) ? result.warnings.map(String) : [],
    unparsedText: typeof result?.unparsedText === "string" ? result.unparsedText : items.length > 0 ? "" : fallbackText,
  };
}

export async function parseTransactionsFromSpeech({
  text,
  mode = "actual",
  categories = [],
  timezone,
  providers,
  userOverride,
}) {
  const timeoutMs = config.llm.timeoutMs || 12000;
  const providerChain = resolveProviderChain(providers, userOverride);
  logVoiceParse("start", {
    mode,
    providers: providerChain,
    timezone: timezone || "Europe/Moscow",
    categoriesCount: categories.length,
  });

  const prompt = JSON.stringify(
    {
      instruction:
        "You are a finance voice parser assistant. Convert Russian speech into structured finance operations JSON.",
      agentProtocol: [
        "Step 1: Split utterance into one or more operations.",
        "Step 2: Determine operation type. Use 'income' only when intent is clearly income (salary, cashback, refund, transfer-in). Otherwise 'expense'.",
        "Step 3: Choose category from user's existing categories only.",
        "Step 4: If no existing category fits, suggest one short category name to create.",
        "Step 5: Return strictly valid JSON object by schema.",
      ],
      categoryPolicy: {
        allowedExistingCategoriesOnly: true,
        matchingRules: [
          "First prefer exact category name match.",
          "Then prefer semantic match (merchant/item -> category).",
          "If confidence is low, do not invent an existing category.",
          "If existing match is only very generic (e.g. 'Другое') and expense has a clear specific intent, prefer suggest_create.",
        ],
        whenNoMatch: "Set categoryResolution='suggest_create' and provide suggestedCategoryToCreate.",
      },
      locale: "ru-RU",
      mode,
      timezone: timezone || "Europe/Moscow",
      userCategories: categories.map((c) => c.name),
      schema: {
        items: [
          {
            type: "income | expense",
            amount: "number > 0",
            description: "string",
            categoryHint: "string from userCategories when matched_existing, otherwise optional",
            categoryResolution: "matched_existing | suggest_create | unknown",
            suggestedCategoryToCreate: "required when categoryResolution=suggest_create",
            date: "optional YYYY-MM-DD",
            confidence: "optional number 0..1",
          },
        ],
        confidence: "number 0..1",
        warnings: ["string"],
        unparsedText: "string",
      },
      text,
    },
    null,
    2
  );

  const providerErrors = [];
  for (const provider of providerChain) {
    if (provider === "heuristic") {
      const fallback = heuristicParse({ text, mode, categories, timezone });
      const normalizedFallback = normalizeResult(
        {
          items: fallback.items,
          confidence: fallback.confidence,
          warnings: fallback.warnings,
          unparsedText: fallback.unparsedText,
        },
        text,
        categories
      );
      logVoiceParse("fallback.heuristic", {
        reason: providerErrors.length > 0 ? "providers_failed" : "heuristic_selected",
        previousErrors: providerErrors,
        items: normalizedFallback.items.length,
      });
      return {
        ...normalizedFallback,
        warnings:
          providerErrors.length > 0
            ? [
                ...normalizedFallback.warnings,
                `LLM недоступна (${providerErrors.join("; ")}), использован fallback-парсер.`,
              ]
            : normalizedFallback.warnings,
      };
    }

    try {
      logVoiceParse("provider.attempt", { provider });
      const raw = await callProvider({ provider, prompt, timeoutMs });
      const parsedJson = extractJson(raw);
      if (!parsedJson) {
        providerErrors.push(`${provider}: invalid JSON`);
        logVoiceParse("provider.invalid_json", { provider });
        continue;
      }
      const normalized = normalizeResult(parsedJson, text, categories);
      if (normalized.items.length === 0) {
        providerErrors.push(`${provider}: empty items`);
        logVoiceParse("provider.empty_items", { provider });
        continue;
      }
      logVoiceParse("provider.success", {
        provider,
        items: normalized.items.length,
        confidence: normalized.confidence,
      });
      return {
        ...normalized,
        warnings:
          providerErrors.length > 0
            ? [`Использован провайдер ${provider} после fallback (${providerErrors.join("; ")}).`, ...normalized.warnings]
            : normalized.warnings,
      };
    } catch (error) {
      providerErrors.push(`${provider}: ${error?.message || "request failed"}`);
      logVoiceParse("provider.failed", {
        provider,
        error: error?.message || "request failed",
      });
    }
  }

  logVoiceParse("fallback.heuristic_all_failed", {
    errors: providerErrors,
  });
  const finalFallback = heuristicParse({ text, mode, categories, timezone });
  const normalizedFinalFallback = normalizeResult(
    {
      items: finalFallback.items,
      confidence: finalFallback.confidence,
      warnings: finalFallback.warnings,
      unparsedText: finalFallback.unparsedText,
    },
    text,
    categories
  );
  return {
    ...normalizedFinalFallback,
    warnings: ["Все провайдеры недоступны, использован fallback-парсер."],
  };
}
