import test from "node:test";
import assert from "node:assert/strict";
import { parseFiscalOcrText } from "../src/services/fiscalOcrParser.js";

const POLZA_OCR_TEXT = `
КАССОВЫЙ ЧЕК
ПРОДАЖА №3285 Смена №36
Флэт Уайт 350 мл
1.000 шт. х 300.00 = 300.00
ИТОГ =300.00
СУММА БЕЗ НДС =300.00
БЕЗНАЛИЧНЫМИ =300.00
РН ККТ: 0010168435045139
ФН 7382440300255976
ФД N0000005201
ФП:1424567415
СМЕНА N00036
ЧЕК N00031
ПРИХОД,
22.06.26 10:50
`;

test("parseFiscalOcrText builds an expense draft from printed fiscal fields", () => {
  const parsed = parseFiscalOcrText(POLZA_OCR_TEXT, {
    engine: "tesseract",
    confidence: 0.74,
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.item.type, "expense");
  assert.equal(parsed.item.amount, 300);
  assert.equal(parsed.item.date, "2026-06-22");
  assert.equal(parsed.item.description, "Флэт Уайт 350 мл");
  assert.equal(parsed.confidence, 0.72);
  assert.equal(parsed.receiptMeta.source, "ocr");
  assert.equal(parsed.receiptMeta.ocrEngine, "tesseract");
  assert.equal(parsed.receiptMeta.fiscalDriveNumber, "7382440300255976");
  assert.equal(parsed.receiptMeta.fiscalDocumentNumber, "5201");
  assert.equal(parsed.receiptMeta.fiscalSign, "1424567415");
  assert.equal(parsed.receiptMeta.operationType, "1");
  assert.equal(parsed.receiptMeta.operationDateTime, "2026-06-22T10:50:00");
  assert.equal(parsed.receiptMeta.amount, 300);
  assert.deepEqual(parsed.receiptMeta.lineItems, [
    {
      name: "Флэт Уайт 350 мл",
      quantity: 1,
      unitPrice: 300,
      lineTotal: 300,
    },
  ]);
  assert.match(parsed.warnings.join("\n"), /OCR/);
});

test("parseFiscalOcrText rejects incomplete OCR text instead of fabricating a draft", () => {
  const parsed = parseFiscalOcrText("ИТОГ 300.00\nФН 7382440300255976\n22.06.26 10:50");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, "receipt_ocr_not_found");
  assert.match(parsed.error, /фискальные реквизиты/i);
});

test("parseFiscalOcrText rejects invalid printed operation dates", () => {
  const parsed = parseFiscalOcrText(POLZA_OCR_TEXT.replace("22.06.26 10:50", "32.13.26 10:50"));

  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, "receipt_ocr_not_found");
});

test("parseFiscalOcrText does not treat item quantity or operation date as receipt amount", () => {
  const parsed = parseFiscalOcrText(`
    22.06.26 10:50
    1.000 шт. X 300.00 = 300.00
    ФН 7382440300255976
    ФД N0000005201
    ФП:1424567415
    ПРОДАЖА
  `);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.item.amount, 300);
  assert.equal(parsed.item.description, "Чек ФН 7382440300255976");
});

test("parseFiscalOcrText corrects a noisy ITOG total using product lines", () => {
  const parsed = parseFiscalOcrText(`
    КАССОВЫЙ ЧЕК
    Флэт Уайт 350 мл
    1.000 шт. х 300.00 = 300.00
    ИТОГ =2508.00
    СУММА БЕЗ НДС =300.00
    ФН 7382440300253976
    ФД N0000003201
    ФП:1424567415
    ПРИХОД
    22.06.26 10:50
  `);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.item.amount, 300);
  assert.equal(parsed.receiptMeta.lineItems?.[0]?.name, "Флэт Уайт 350 мл");
  assert.match(parsed.warnings.join("\n"), /товарным позициям/i);
});

test("parseFiscalOcrText extracts multiple product lines", () => {
  const parsed = parseFiscalOcrText(`
    КАССОВЫЙ ЧЕК
    Хлеб белый
    1.000 шт. x 45.00 = 45.00
    Молоко 2.5%
    2.000 шт. x 89.90 = 179.80
    ИТОГ =224.80
    ФН 7382440300255976
    ФД N0000005201
    ФП:1424567415
    ПРИХОД
    22.06.26 10:50
  `);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.item.amount, 224.8);
  assert.equal(parsed.item.description, "Хлеб белый, Молоко 2.5%");
  assert.equal(parsed.receiptMeta.lineItems?.length, 2);
  assert.equal(parsed.receiptMeta.lineItems?.[1]?.lineTotal, 179.8);
});
