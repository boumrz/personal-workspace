import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RATE_LIMIT_ENABLED = "false";

const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/database/db.js");
const { buildReceiptPreview } = await import("../src/services/transactionsDataTools.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const originalQuery = pool.query.bind(pool);
const tesseractLanguages = spawnSync("tesseract", ["--list-langs"], {
  encoding: "utf8",
  windowsHide: true,
});
const hasTesseractOcrRuntime =
  tesseractLanguages.status === 0 &&
  /\brus\b/i.test(tesseractLanguages.stdout || "") &&
  /\beng\b/i.test(tesseractLanguages.stdout || "");
const SAMPLE_QR_PAYLOAD =
  "t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1";
const SAMPLE_QR_RECEIPT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQAAAABUY/ToAAAEBklEQVR4nO1cW46jMBBsN0j5BGkPkKOQm432SHsDOMocYCT4jATqVbcfkKyQE4fMLKbrg8HEJR5TsrvLDYYgDR0mEgGUGQNGe6xBmTFgtMcalBkDRnusQZkxYLTHGpQZA0Z7rEGZOT4h41DyXgnQceMCk9245uB7XX74alOASSyGMqMgBjTypy+I2kp2+VgPQC0Uy1/nzq0+2xjwYMwhjC9DaTf0+0z3SZsdpbY65/PABI6FMt/3hMq7tmn62gBUI+8BmIYmQ50BgObPVudEZWatIejOYwlNO5XU1T1AV3+BgeqrJBi2OicqM0sNVTxtsUqaFghk4AGYSoDhREaOMWi394nKfPcT6iThqnl3KMF89AWZj8+TDaztMUnTGFudMwGYQhIo893jEC2OVCM3/aarwcieG6q2OCcqM9fcHuyYE9CQVY5P5uXg3NzXfaIy366h3u0RiSskJpEc6/3Y1FYiqdH1Uw1FgYdiEg8y1qe+iKnYszt9dqJ5zzlTgEkshjLfPQ4RDzJ24zDLp7AWtUxts1mt41AceKy5jOEnr4KbbkPtrCGRT5jzdC7LTAn4uoYKNxhJAGTHHPkhREESD9mVM9VQhkrAZCYsIukQP3vRkNfVjaRUQ1kqAV9mViMYc3YpvExe5iKrrx7SpHY40a7v83lgAueITHMZTkTtYAw07E4ziDg5s5HRrJz/4WpTgEkshjKjIBvdSOgs2ZiIxlqJo+sj4ZGNhzSmfhx4NJ965IarN7sXUuOr0TQvy1cJ+Dqz8EKSKEhiailEMxwFSY/qaqCr/4+rfRr4PMVBmVHQIt+SWlhvW9tfW7vqMdtFMrWpP/QI8CBMCIaPzePdMb9oBrIOa+MhWBpH6jHmpgTcZM21tU0XAIkxDUtJOSGphrJUAr6+XkY3nvQ8ZVWiMBdi+/xNx6H8lICvMydrDfnYxx0zH/1knKQ+neWo75flrYSnUcrWWIFUV65ZnEoCKEaAoeY6RqnJvxrqzle2HCfusr/7RGV+T0wNNzZQqAcBmeRcqaPOZQ8Dj7fmCvcFsbN85mJG3tHcPkcl4Ov+EDkHKLww7etByMfUAaqhHJWAm8xlS7dxWZwGi7lM/aFclYCbffcDwrxl1zUaXwE7v4j/41ebAkxiMZQZBf3z3Y+bIvwmFKe5xVj1GB8GHs+nBgl7JPMKVbFki/AX8ZD/lIzWU2emBNzsmw3U1YV88oPfsh9LsYagadk4Gn6N+71PVOb3PaEm5PZdHaKg2Z2eV/X1vxIDHjUeEojRaGvyYc73w6q+dNnXfaIyv+P9MrDBji/2uKsfojko0njoMeBBmEa/cZ7V/xOVGQHGOqxCmTFgtMcalBkDRnusQZkxYLTHGpQZw76e0F9nLlpFI9lSbgAAAABJRU5ErkJggg==",
  "base64"
);
const REAL_RECEIPT_FIXTURES = [
  {
    filename: "cloud-payments-390.png",
    expected: {
      source: "qr",
      amount: 390,
      date: "2017-12-18",
      fiscalDriveNumber: "8710000100983019",
      fiscalDocumentNumber: "13513",
      fiscalSign: "3647700053",
      operationDateTime: "2017-12-18T13:15:00",
      qrPayload: "t=20171218T131500&s=390.00&fn=8710000100983019&i=13513&fp=3647700053&n=1",
    },
  },
  {
    filename: "four-paws-419-49.png",
    expected: {
      source: "qr",
      amount: 419.49,
      date: "2026-06-09",
      fiscalDriveNumber: "7380440902817443",
      fiscalDocumentNumber: "3267",
      fiscalSign: "2742137682",
      operationDateTime: "2026-06-09T10:21:00",
      qrPayload: "t=20260609T1021&s=419.49&fn=7380440902817443&i=3267&fp=2742137682&n=1",
    },
  },
  {
    filename: "four-paws-phone-419-49.png",
    expected: {
      source: "qr",
      amount: 419.49,
      date: "2026-06-09",
      fiscalDriveNumber: "7380440902817443",
      fiscalDocumentNumber: "3267",
      fiscalSign: "2742137682",
      operationDateTime: "2026-06-09T10:21:00",
      qrPayload: "t=20260609T1021&s=419.49&fn=7380440902817443&i=3267&fp=2742137682&n=1",
    },
  },
  {
    filename: "receipt-photo-polza-300.png",
    expected: {
      source: "ocr",
      amount: 300,
      date: "2026-06-22",
      description: "Флэт Уайт 350 мл",
      fiscalDriveNumber: "7382410900253926",
      fiscalDocumentNumber: "5201",
      fiscalSign: "1424567415",
      operationDateTime: "2026-06-22T10:50:00",
      ocrEngine: "tesseract",
    },
  },
];

function buildAccessToken(userId = 42) {
  return jwt.sign({ userId, type: "access" }, process.env.JWT_SECRET);
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

test("POST /api/v2/transactions/receipt/parse validates image upload", { concurrency: false }, async () => {
  const token = buildAccessToken();
  const response = await request(app)
    .post("/api/v2/transactions/receipt/parse")
    .set("Authorization", `Bearer ${token}`)
    .field("timezone", "Europe/Moscow");

  assert.equal(response.status, 400);
  assert.match(String(response.body.error || ""), /image|file/i);
});

test("POST /api/v2/transactions/receipt/parse decodes a QR image into a draft", { concurrency: false }, async () => {
  const token = buildAccessToken();
  const response = await request(app)
    .post("/api/v2/transactions/receipt/parse")
    .set("Authorization", `Bearer ${token}`)
    .field("timezone", "Europe/Moscow")
    .attach("file", SAMPLE_QR_RECEIPT_PNG, {
      filename: "1000014568.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.items?.length, 1);
  assert.equal(response.body.items[0].amount, 390);
  assert.equal(response.body.items[0].date, "2017-12-18");
  assert.equal(response.body.items[0].description, "Чек ФН 8710000100983019");
  assert.equal(response.body.confidence, 0.98);
  assert.equal(response.body.receiptMeta?.source, "qr");
  assert.equal(response.body.receiptMeta?.qrPayload, SAMPLE_QR_PAYLOAD);
  assert.equal(response.body.preview?.source, "receipt");
  assert.equal(response.body.preview?.drafts?.length, 1);
});

for (const fixture of REAL_RECEIPT_FIXTURES) {
  test(`POST /api/v2/transactions/receipt/parse decodes real receipt fixture ${fixture.filename}`, {
    concurrency: false,
    skip:
      fixture.expected.source === "ocr" && !hasTesseractOcrRuntime
        ? "Tesseract rus/eng runtime is not installed locally."
        : false,
  }, async () => {
    const token = buildAccessToken();
    const image = readFileSync(path.join(__dirname, "fixtures", "receipts", fixture.filename));
    const response = await request(app)
      .post("/api/v2/transactions/receipt/parse")
      .set("Authorization", `Bearer ${token}`)
      .field("timezone", "Europe/Moscow")
      .attach("file", image, {
        filename: fixture.filename,
        contentType: "image/png",
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.items?.length, 1);
    assert.equal(response.body.items[0].type, "expense");
    assert.equal(response.body.items[0].amount, fixture.expected.amount);
    assert.equal(response.body.items[0].date, fixture.expected.date);
    const description = response.body.items[0].description;
    if (fixture.expected.source === "ocr") {
      assert.ok(description?.trim(), "OCR receipt description must not be empty");
      if (fixture.expected.description) {
        assert.match(description.toLowerCase(), /флэт|чек фн/i);
      }
    } else {
      assert.equal(description, fixture.expected.description || `Чек ФН ${fixture.expected.fiscalDriveNumber}`);
    }
    assert.equal(response.body.confidence, fixture.expected.source === "ocr" ? 0.72 : 0.98);
    assert.equal(response.body.receiptMeta?.source, fixture.expected.source);
    if (fixture.expected.source === "qr") {
      assert.equal(response.body.receiptMeta?.qrPayload, fixture.expected.qrPayload);
    } else {
      assert.equal(response.body.receiptMeta?.ocrEngine, fixture.expected.ocrEngine);
      assert.match(response.body.warnings?.join("\n") || "", /OCR/i);
      assert.ok(Array.isArray(response.body.receiptMeta?.lineItems));
      assert.ok((response.body.receiptMeta?.lineItems?.length || 0) >= 1);
      assert.equal(response.body.receiptMeta?.lineItems?.[0]?.lineTotal, fixture.expected.amount);
    }
    assert.equal(response.body.receiptMeta?.fiscalDriveNumber, fixture.expected.fiscalDriveNumber);
    assert.equal(response.body.receiptMeta?.fiscalDocumentNumber, fixture.expected.fiscalDocumentNumber);
    assert.equal(response.body.receiptMeta?.fiscalSign, fixture.expected.fiscalSign);
    assert.equal(response.body.receiptMeta?.operationType, "1");
    assert.equal(response.body.receiptMeta?.operationDateTime, fixture.expected.operationDateTime);
    assert.equal(response.body.preview?.drafts?.length, 1);
  });
}

test("buildReceiptPreview builds a QR preview without calling an LLM parser", { concurrency: false }, async () => {
  let llmCalls = 0;
  const preview = await buildReceiptPreview({
    imageFile: {
      filename: "1000014568.webp",
      mimeType: "image/webp",
      buffer: SAMPLE_QR_RECEIPT_PNG,
    },
    timezone: "Europe/Moscow",
    qrDecoder: async () => SAMPLE_QR_PAYLOAD,
    visionParser: async () => {
      llmCalls += 1;
      return { items: [{ type: "expense", amount: 1 }], warnings: [] };
    },
  });

  assert.equal(llmCalls, 0);
  assert.equal(preview.drafts.length, 1);
  assert.equal(preview.drafts[0].amount, 390);
  assert.equal(preview.receiptMeta?.source, "qr");
});

test("buildReceiptPreview falls back to OCR after a QR decoder timeout", { concurrency: false }, async () => {
  let ocrCalls = 0;
  const timeoutError = new Error("QR decoder timed out.");
  timeoutError.statusCode = 503;
  timeoutError.code = "receipt_qr_decoder_unavailable";

  const preview = await buildReceiptPreview({
    imageFile: {
      filename: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-image"),
    },
    qrDecoder: async () => {
      throw timeoutError;
    },
    ocrReader: async () => {
      ocrCalls += 1;
      return {
        text: "КАССОВЫЙ ЧЕК\nИТОГ\n390.00",
        engine: "tesseract",
      };
    },
  });

  assert.equal(ocrCalls, 1);
  assert.equal(preview.drafts.length, 1);
  assert.equal(preview.drafts[0].amount, 390);
  assert.equal(preview.receiptMeta?.source, "ocr_partial");
  assert.match(preview.warnings.join("\n"), /Проверьте черновик/i);
});

test("buildReceiptPreview surfaces OCR runtime failures as unavailable", { concurrency: false }, async () => {
  await assert.rejects(
    () =>
      buildReceiptPreview({
        imageFile: {
          filename: "receipt.png",
          mimeType: "image/png",
          buffer: Buffer.from("fake-image"),
        },
        qrDecoder: async () => null,
        ocrReader: async () => {
          const error = new Error("Tesseract binary is not available.");
          error.statusCode = 503;
          error.code = "receipt_ocr_unavailable";
          throw error;
        },
      }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "receipt_ocr_unavailable");
      assert.match(String(error.message || ""), /Tesseract/i);
      return true;
    }
  );
});

test("receipt parser does not infer amount from numeric filename", { concurrency: false }, async () => {
  await assert.rejects(
    () =>
      buildReceiptPreview({
        imageFile: {
          filename: "1000014568.webp",
          mimeType: "image/webp",
          buffer: Buffer.from("fake-image"),
        },
        timezone: "Europe/Moscow",
        qrDecoder: async () => null,
        ocrReader: async () => null,
      }),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "receipt_ocr_not_found");
      assert.match(String(error.message || ""), /OCR не смог извлечь фискальные реквизиты/i);
      return true;
    }
  );
});

test("receipt parser rejects decoded invalid QR payloads without a draft", { concurrency: false }, async () => {
  await assert.rejects(
    () =>
      buildReceiptPreview({
        imageFile: {
          filename: "receipt.png",
          mimeType: "image/png",
          buffer: Buffer.from("fake-image"),
        },
        timezone: "Europe/Moscow",
        qrDecoder: async () => "t=20171218T1312&s=390.00",
      }),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "receipt_qr_invalid");
      assert.match(String(error.message || ""), /обязательных реквизитов/i);
      return true;
    }
  );
});
