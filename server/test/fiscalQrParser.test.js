import test from "node:test";
import assert from "node:assert/strict";

import { parseFiscalQrPayload } from "../src/services/fiscalQrParser.js";

const SAMPLE_PAYLOAD =
  "t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1";

test("parseFiscalQrPayload builds an expense draft from a valid fiscal QR payload", () => {
  const result = parseFiscalQrPayload(SAMPLE_PAYLOAD);

  assert.equal(result.ok, true);
  assert.equal(result.item.type, "expense");
  assert.equal(result.item.amount, 390);
  assert.equal(result.item.description, "Чек ФН 8710000100983019");
  assert.equal(result.item.categoryHint, "Другое");
  assert.equal(result.item.categoryResolution, "suggest_create");
  assert.equal(result.item.suggestedCategoryToCreate, "Другое");
  assert.equal(result.item.date, "2017-12-18");
  assert.equal(result.item.confidence, 0.98);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.confidence, 0.98);
  assert.deepEqual(result.receiptMeta, {
    source: "qr",
    qrPayload: SAMPLE_PAYLOAD,
    fiscalDriveNumber: "8710000100983019",
    fiscalDocumentNumber: "3647700053",
    fiscalSign: "13513",
    operationType: "1",
    operationDateTime: "2017-12-18T13:12:00",
    amount: 390,
  });
});

test("parseFiscalQrPayload accepts case-insensitive keys, decimal comma, and ISO date-time", () => {
  const result = parseFiscalQrPayload(
    "T=2026-06-23T09:45:30&S=125,75&FN=999&I=123&FP=456&N=2&ignored=value"
  );

  assert.equal(result.ok, true);
  assert.equal(result.item.type, "income");
  assert.equal(result.item.amount, 125.75);
  assert.equal(result.item.date, "2026-06-23");
  assert.equal(result.item.confidence, 0.75);
  assert.deepEqual(result.warnings, ["Возврат прихода"]);
  assert.equal(result.receiptMeta.operationDateTime, "2026-06-23T09:45:30");
});

test("parseFiscalQrPayload rejects payloads without required fiscal fields", () => {
  const requiredFields = {
    t: "20171218T1312",
    s: "390.00",
    fn: "8710000100983019",
    i: "3647700053",
    fp: "13513",
    n: "1",
  };

  for (const missingField of Object.keys(requiredFields)) {
    const payload = Object.entries(requiredFields)
      .filter(([field]) => field !== missingField)
      .map(([field, value]) => `${field}=${value}`)
      .join("&");
    const result = parseFiscalQrPayload(payload);

    assert.equal(result.ok, false);
    assert.equal(result.code, "receipt_qr_invalid");
    assert.match(result.error, /обязательных реквизитов/i);
  }
});

test("parseFiscalQrPayload rejects zero, negative, and non-finite amounts", () => {
  for (const amount of ["0", "-1", "NaN", "Infinity"]) {
    const result = parseFiscalQrPayload(
      `t=20171218T1312&s=${amount}&fn=8710000100983019&i=3647700053&fp=13513&n=1`
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "receipt_qr_invalid");
  }
});

test("parseFiscalQrPayload rejects unsupported operation types instead of guessing", () => {
  const result = parseFiscalQrPayload(
    "t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=9"
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "receipt_qr_invalid");
  assert.match(result.error, /тип операции/i);
});

test("parseFiscalQrPayload rejects invalid operation dates", () => {
  const result = parseFiscalQrPayload(
    "t=20171318T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1"
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "receipt_qr_invalid");
  assert.match(result.error, /дат/i);
});
