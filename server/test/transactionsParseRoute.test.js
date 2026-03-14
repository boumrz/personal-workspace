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

function mockParseRouteQueries() {
  pool.query = async (sql) => {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

    if (normalized.startsWith("select id, name, color, icon from categories")) {
      return {
        rows: [{ id: 1, name: "Еда", color: "#4a9ed6", icon: "Utensils" }],
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
