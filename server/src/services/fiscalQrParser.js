const REQUIRED_FIELDS = ["t", "s", "fn", "i", "fp", "n"];

const INVALID_QR_ERROR =
  "QR-код найден, но в нем нет обязательных реквизитов суммы или фискального документа.";

function invalidQr(error = INVALID_QR_ERROR) {
  return {
    ok: false,
    code: "receipt_qr_invalid",
    error,
  };
}

function extractQueryText(payload) {
  let text = String(payload || "").trim();
  const queryStart = text.indexOf("?");
  if (queryStart !== -1) {
    text = text.slice(queryStart + 1);
  }
  const hashStart = text.indexOf("#");
  if (hashStart !== -1) {
    text = text.slice(0, hashStart);
  }
  return text.replace(/^&+/, "");
}

function parsePayloadParams(payload) {
  const params = new URLSearchParams(extractQueryText(payload));
  const result = new Map();
  for (const [key, value] of params.entries()) {
    const normalizedKey = String(key || "").trim().toLowerCase();
    if (normalizedKey && !result.has(normalizedKey)) {
      result.set(normalizedKey, String(value || "").trim());
    }
  }
  return result;
}

function parseAmount(value) {
  const normalized = String(value || "").trim().replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isValidDateTimePart({ year, month, day, hour, minute, second }) {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function parseFiscalDateTime(value) {
  const text = String(value || "").trim();
  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  const match = compactMatch || isoMatch;
  if (!match) return null;

  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond = "00"] = match;
  const dateTime = {
    year: Number(rawYear),
    month: Number(rawMonth),
    day: Number(rawDay),
    hour: Number(rawHour),
    minute: Number(rawMinute),
    second: Number(rawSecond),
  };

  if (!isValidDateTimePart(dateTime)) {
    return null;
  }

  const date = `${rawYear}-${rawMonth}-${rawDay}`;
  const time = `${rawHour}:${rawMinute}:${rawSecond}`;
  return {
    date,
    dateTime: `${date}T${time}`,
  };
}

function resolveOperation(operationType) {
  if (operationType === "1") {
    return {
      type: "expense",
      warnings: [],
      confidence: 0.98,
    };
  }

  if (operationType === "2") {
    return {
      type: "income",
      warnings: ["Возврат прихода"],
      confidence: 0.75,
    };
  }

  return null;
}

export function parseFiscalQrPayload(payload) {
  const qrPayload = String(payload || "").trim();
  const params = parsePayloadParams(qrPayload);

  for (const field of REQUIRED_FIELDS) {
    if (!params.get(field)) {
      return invalidQr();
    }
  }

  const amount = parseAmount(params.get("s"));
  if (amount === null) {
    return invalidQr();
  }

  const operationDateTime = parseFiscalDateTime(params.get("t"));
  if (!operationDateTime) {
    return invalidQr("QR-код найден, но дата операции в нем некорректна.");
  }

  const operationType = params.get("n");
  const operation = resolveOperation(operationType);
  if (!operation) {
    return invalidQr("QR-код найден, но тип операции чека не поддерживается.");
  }

  const fiscalDriveNumber = params.get("fn");
  const fiscalDocumentNumber = params.get("i");
  const fiscalSign = params.get("fp");

  return {
    ok: true,
    item: {
      type: operation.type,
      amount,
      description: `Чек ФН ${fiscalDriveNumber}`,
      categoryHint: "Другое",
      categoryResolution: "suggest_create",
      suggestedCategoryToCreate: "Другое",
      date: operationDateTime.date,
      confidence: operation.confidence,
    },
    confidence: operation.confidence,
    warnings: operation.warnings,
    receiptMeta: {
      source: "qr",
      qrPayload,
      fiscalDriveNumber,
      fiscalDocumentNumber,
      fiscalSign,
      operationType,
      operationDateTime: operationDateTime.dateTime,
      amount,
    },
  };
}
