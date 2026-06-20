import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RATE_LIMIT_ENABLED = "false";

const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/database/db.js");

const originalQuery = pool.query.bind(pool);

function buildAccessToken(userId = 42) {
  return jwt.sign({ userId, type: "access" }, process.env.JWT_SECRET);
}

function parseBinaryResponse(res, callback) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

function mockParseRouteQueries() {
  pool.query = async (sql) => {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

    if (normalized.startsWith("select id, name, color, icon, type from categories")) {
      return {
        rows: [{ id: 1, name: "Еда", color: "#4a9ed6", icon: "Utensils", type: "expense" }],
      };
    }

    if (normalized.startsWith("select voice_llm_provider, voice_llm_provider_chain, voice_llm_enabled_providers from users")) {
      return {
        rows: [{}],
      };
    }

    throw new Error(`Unexpected SQL query in test: ${sql}`);
  };
}

test("POST /api/v2/transactions/parse requires auth token", { concurrency: false }, async () => {
  const response = await request(app)
    .post("/api/v2/transactions/parse")
    .send({ text: "Потратил 200 на такси" });

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Access token required");
});

test("POST /api/v2/transactions/parse validates request payload", { concurrency: false }, async () => {
  const token = buildAccessToken();

  const missingTextResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ mode: "actual" });

  assert.equal(missingTextResponse.status, 400);
  assert.match(missingTextResponse.body.error, /text/i);

  const invalidModeResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Потратил 200", mode: "invalid" });

  assert.equal(invalidModeResponse.status, 400);
  assert.match(invalidModeResponse.body.error, /mode/i);

  const invalidQuestionResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Сколько будет 2+2?", mode: "actual" });

  assert.equal(invalidQuestionResponse.status, 400);
  assert.match(invalidQuestionResponse.body.error, /transaction/i);

  const unsupportedFieldResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Потратил 200 на еду", mode: "actual", unexpected: true });

  assert.equal(unsupportedFieldResponse.status, 400);
  assert.match(unsupportedFieldResponse.body.error, /unsupported fields/i);

  const invalidContextResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Потратил 200 на еду", mode: "actual", context: { timezone: "UTC", extra: "field" } });

  assert.equal(invalidContextResponse.status, 400);
  assert.match(invalidContextResponse.body.error, /context/i);

  const invalidTimezoneResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Потратил 200 на еду", mode: "actual", context: { timezone: "../../../etc/passwd" } });

  assert.equal(invalidTimezoneResponse.status, 400);
  assert.match(invalidTimezoneResponse.body.error, /timezone/i);

  const invalidProviderChainResponse = await request(app)
    .post("/api/v2/transactions/parse")
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "Потратил 200 на еду", mode: "actual", providerChain: "heuristic" });

  assert.equal(invalidProviderChainResponse.status, 400);
  assert.match(invalidProviderChainResponse.body.error, /providerchain/i);
});

test("POST /api/v2/transactions/parse returns parsed items via heuristic provider", { concurrency: false }, async () => {
  const token = buildAccessToken();

  try {
    mockParseRouteQueries();

    const response = await request(app)
      .post("/api/v2/transactions/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({
        text: "Потратил 450 на еду",
        mode: "actual",
        providerChain: ["heuristic"],
      });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.items));
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].type, "expense");
    assert.equal(response.body.items[0].amount, 450);
    assert.ok(!Object.hasOwn(response.body.items[0], "description"));
    assert.ok(!Object.hasOwn(response.body.items[0], "date"));
  } finally {
    pool.query = originalQuery;
  }
});

test("POST /api/v2/transactions/parse includes parsed date when provided in phrase", { concurrency: false }, async () => {
  const token = buildAccessToken();

  try {
    mockParseRouteQueries();

    const response = await request(app)
      .post("/api/v2/transactions/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({
        text: "Вчера потратил 1200 на еду",
        mode: "actual",
        providerChain: ["heuristic"],
        context: { timezone: "Europe/Moscow" },
      });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.items));
    assert.equal(response.body.items.length, 1);
    assert.match(String(response.body.items[0].date || ""), /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    pool.query = originalQuery;
  }
});

test("POST /api/v2/transactions/export returns spreadsheet payload", { concurrency: false }, async () => {
  const token = buildAccessToken();
  try {
    pool.query = async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.startsWith("select t.id")) {
        return {
          rows: [
            {
              id: 1,
              type: "expense",
              amount: "1200.00",
              description: "Lunch",
              date: "2026-03-28",
              category_id: 9,
              category_name: "Food",
              category_color: "#4a9ed6",
              category_icon: "Utensils",
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL query in export test: ${sql}`);
    };

    const response = await request(app)
      .post("/api/v2/transactions/export")
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .send({ scope: "actual" });

    assert.equal(response.status, 200);
    assert.match(
      String(response.headers["content-type"] || ""),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i
    );
    assert.match(String(response.headers["content-disposition"] || ""), /\.xlsx"/i);
    assert.equal(response.body.subarray(0, 2).toString("utf8"), "PK");
  } finally {
    pool.query = originalQuery;
  }
});

test("POST /api/v2/transactions/import parses csv file to preview", { concurrency: false }, async () => {
  const token = buildAccessToken();
  const csv = "date,type,amount,category,description\n2026-03-29,expense,490,Food,Coffee";

  try {
    pool.query = async (sql) => {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.startsWith("select id, name, color, icon, type from categories")) {
        return { rows: [{ id: 1, name: "Food", color: "#4a9ed6", icon: "Utensils", type: "expense" }] };
      }
      throw new Error(`Unexpected SQL query in import test: ${sql}`);
    };

    const response = await request(app)
      .post("/api/v2/transactions/import")
      .set("Authorization", `Bearer ${token}`)
      .field("targetMode", "actual")
      .attach("file", Buffer.from(csv, "utf8"), "import.csv");

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.items));
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].amount, 490);
    assert.equal(response.body.items[0].type, "expense");
    assert.equal(response.body.preview?.source, "excel");
    assert.equal(response.body.preview?.drafts?.length, 1);
  } finally {
    pool.query = originalQuery;
  }
});

test("POST /api/v2/transactions/receipt/parse validates image upload", { concurrency: false }, async () => {
  const token = buildAccessToken();
  const response = await request(app)
    .post("/api/v2/transactions/receipt/parse")
    .set("Authorization", `Bearer ${token}`)
    .field("timezone", "Europe/Moscow");

  assert.equal(response.status, 400);
  assert.match(String(response.body.error || ""), /image|file/i);
});
