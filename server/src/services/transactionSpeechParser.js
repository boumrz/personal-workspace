import config from "../config/config.js";

const DEFAULT_MODEL_BY_PROVIDER = {
  openrouter: "google/gemini-2.0-flash-exp:free",
  groq: "llama-3.1-8b-instant",
  gemini: "gemini-2.0-flash",
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

function stemRu(word) {
  const normalized = normalizeText(word);
  if (!normalized) return "";
  return normalized
    .replace(
      /(иями|ями|ами|иях|иях|иям|ием|иях|ого|ему|ому|ыми|ими|ой|ий|ый|ая|ое|ые|ам|ям|ах|ях|ов|ев|ом|ем|а|я|ы|и|е|у|ю|о)$/i,
      ""
    )
    .trim();
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

function extractJson(text) {
  if (!text) return null;
  const direct = text.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) {
    return JSON.parse(direct);
  }
  const blockMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) {
    return JSON.parse(blockMatch[1].trim());
  }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return JSON.parse(objectMatch[0]);
  }
  return null;
}

async function callOpenAiCompatible({ baseUrl, apiKey, model, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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

function normalizeResult(result, fallbackText) {
  const items = Array.isArray(result?.items)
    ? result.items
        .map((item) => {
          const amount = Number(item?.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            return null;
          }
          const type = item?.type === "income" ? "income" : "expense";
          return {
            type,
            amount: Math.round(amount * 100) / 100,
            description: String(item?.description || "Голосовая операция").trim(),
            categoryHint: item?.categoryHint ? String(item.categoryHint).trim() : undefined,
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
}) {
  const provider = String(config.llm.provider || "heuristic").toLowerCase();
  const apiKey = config.llm.apiKey;
  const timeoutMs = config.llm.timeoutMs || 12000;

  const prompt = JSON.stringify(
    {
      instruction:
        "Convert speech text into finance operations JSON. Preserve multiple operations. Prefer expense unless clearly income.",
      locale: "ru-RU",
      mode,
      timezone: timezone || "Europe/Moscow",
      categories: categories.map((c) => c.name),
      schema: {
        items: [
          {
            type: "income | expense",
            amount: "number > 0",
            description: "string",
            categoryHint: "optional string",
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

  if (!apiKey || provider === "heuristic") {
    return heuristicParse({ text, mode, categories, timezone });
  }

  try {
    let raw = "";
    if (provider === "openrouter") {
      raw = await callOpenAiCompatible({
        baseUrl: config.llm.baseUrl || "https://openrouter.ai/api/v1",
        apiKey,
        model: config.llm.model || DEFAULT_MODEL_BY_PROVIDER.openrouter,
        prompt,
        timeoutMs,
      });
    } else if (provider === "groq") {
      raw = await callOpenAiCompatible({
        baseUrl: config.llm.baseUrl || "https://api.groq.com/openai/v1",
        apiKey,
        model: config.llm.model || DEFAULT_MODEL_BY_PROVIDER.groq,
        prompt,
        timeoutMs,
      });
    } else if (provider === "gemini") {
      raw = await callGemini({
        apiKey,
        model: config.llm.model || DEFAULT_MODEL_BY_PROVIDER.gemini,
        prompt,
        timeoutMs,
      });
    } else {
      return heuristicParse({ text, mode, categories, timezone });
    }

    const parsedJson = extractJson(raw);
    if (!parsedJson) {
      return {
        ...heuristicParse({ text, mode, categories, timezone }),
        warnings: ["Модель вернула невалидный JSON, использован fallback."],
      };
    }

    return normalizeResult(parsedJson, text);
  } catch (error) {
    console.error("[voice-parse] LLM parse failed:", error?.message || error);
    return {
      ...heuristicParse({ text, mode, categories, timezone }),
      warnings: ["LLM временно недоступна, использован fallback-парсер."],
    };
  }
}
