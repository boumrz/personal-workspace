import test from "node:test";
import assert from "node:assert/strict";
import { __testables } from "../src/services/transactionSpeechParser.js";

test("parseAmount parses plain numeric values", () => {
  assert.equal(__testables.parseAmount("Spent 1 250"), 1250);
  assert.equal(__testables.parseAmount("income 99"), 99);
  assert.equal(__testables.parseAmount("no numbers"), null);
});

test("heuristic parser builds operation and resolves category hint", () => {
  const result = __testables.heuristicParse({
    text: "spent 450 taxi",
    mode: "actual",
    categories: [{ id: "1", name: "taxi" }],
    timezone: "Europe/Moscow",
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].type, "expense");
  assert.equal(result.items[0].amount, 450);
  assert.equal(result.items[0].categoryHint, "taxi");
});

test("detectType respects explicit income words and planned mode", () => {
  assert.equal(__testables.detectType("cashback 100", "actual"), "income");
  assert.equal(__testables.detectType("buy coffee 200", "planned"), "expense");
});

test("detectDateHint parses explicit Russian operation dates", () => {
  assert.equal(__testables.detectDateHint("потратил 500 на кофе 5 июня 2026", "Europe/Moscow"), "2026-06-05");
  assert.equal(__testables.detectDateHint("расход 500 на продукты за 05.06.2026", "Europe/Moscow"), "2026-06-05");
});

test("detectDateHint parses Russian month dates without explicit year", () => {
  const currentYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
  }).format(new Date());

  assert.equal(__testables.detectDateHint("5.000 на продукты 22 мая", "Europe/Moscow"), `${currentYear}-05-22`);
  assert.equal(
    __testables.detectDateHint("потратил на продукты двадцать второго мая", "Europe/Moscow"),
    `${currentYear}-05-22`
  );
});

test("heuristic parser keeps detected operation date", () => {
  const result = __testables.heuristicParse({
    text: "потратил 450 на такси 5 июня 2026",
    mode: "actual",
    categories: [{ id: "1", name: "Такси" }],
    timezone: "Europe/Moscow",
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].date, "2026-06-05");
});

test("extractJson reads fenced JSON payload", () => {
  const payload = "```json\n{\n  \"items\": [{\"type\":\"expense\",\"amount\":100}],\n  \"confidence\": 0.8,\n  \"warnings\": [],\n  \"unparsedText\": \"\"\n}\n```";
  const parsed = __testables.extractJson(payload);

  assert.ok(parsed);
  assert.equal(parsed.items[0].amount, 100);
});

test("normalizeResult suggests category creation when no existing match", () => {
  const normalized = __testables.normalizeResult(
    {
      items: [
        {
          type: "expense",
          amount: 320,
          description: "Takeout coffee",
          categoryHint: "Coffee",
          date: "2026-03-28",
        },
      ],
      confidence: 0.7,
      warnings: [],
      unparsedText: "",
    },
    "Coffee 320",
    [{ id: "1", name: "Food" }]
  );

  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].categoryResolution, "suggest_create");
  assert.equal(normalized.items[0].suggestedCategoryToCreate, "Coffee");
  assert.equal(normalized.items[0].date, "2026-03-28");
  assert.ok(!Object.hasOwn(normalized.items[0], "description"));
});

test("normalizeResult falls back to source phrase date when LLM omits it", () => {
  const currentYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
  }).format(new Date());
  const normalized = __testables.normalizeResult(
    {
      items: [
        {
          type: "expense",
          amount: 5000,
          categoryHint: "Продукты",
        },
      ],
      confidence: 0.7,
      warnings: [],
      unparsedText: "",
    },
    "5.000 на продукты 22 мая",
    [{ id: "1", name: "Продукты" }],
    "Europe/Moscow"
  );

  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].date, `${currentYear}-05-22`);
});

test("normalizeResult prefers current-year source date over LLM year when source has no year", () => {
  const currentYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
  }).format(new Date());
  const normalized = __testables.normalizeResult(
    {
      items: [
        {
          type: "expense",
          amount: 5000,
          categoryHint: "Продукты",
          date: "2031-05-22",
        },
      ],
      confidence: 0.7,
      warnings: [],
      unparsedText: "",
    },
    "5.000 на продукты 22 мая",
    [{ id: "1", name: "Продукты" }],
    "Europe/Moscow"
  );

  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].date, `${currentYear}-05-22`);
});
