import { parseFiscalQrPayload } from "./fiscalQrParser.js";
import { parseFiscalOcrText } from "./fiscalOcrParser.js";
import { decodeReceiptQrFromImage } from "./receiptQrDecoder.js";
import { readReceiptOcrText } from "./receiptOcrReader.js";

function parseDecimal(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const dd = String(dotMatch[1]).padStart(2, "0");
    const mm = String(dotMatch[2]).padStart(2, "0");
    const yyyy = dotMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
    parsed.getDate()
  ).padStart(2, "0")}`;
}

function normalizeType(value, fallback = "expense") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  if (["income", "доход", "in", "plus", "+"].includes(text)) return "income";
  if (["expense", "расход", "out", "minus", "-"].includes(text)) return "expense";
  if (/доход|зарплат|income|cashback|refund|\+/.test(text)) return "income";
  return "expense";
}

function clampDrafts(items) {
  return items
    .map((item) => {
      const amount = parseDecimal(item?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        type: normalizeType(item?.type),
        amount,
        description: String(item?.description || "").trim().slice(0, 160),
        categoryHint: String(item?.categoryHint || "").trim().slice(0, 80),
        categoryResolution:
          item?.categoryResolution === "matched_existing" ||
          item?.categoryResolution === "suggest_create" ||
          item?.categoryResolution === "unknown"
            ? item.categoryResolution
            : "unknown",
        suggestedCategoryToCreate: String(item?.suggestedCategoryToCreate || "")
          .trim()
          .slice(0, 80),
        date: normalizeDate(item?.date) || undefined,
        ...(Number.isFinite(Number(item?.confidence)) ? { confidence: Number(item.confidence) } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeReceiptItems(items) {
  return clampDrafts(items).map((item) => ({
    ...item,
    date: normalizeDate(item.date) || undefined,
    categoryResolution: item.categoryResolution || "unknown",
  }));
}

function httpError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function buildReceiptPreviewResult(parsed) {
  const items = normalizeReceiptItems([parsed.item]);
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 20) : [];
  return {
    source: "receipt",
    title: "Receipt Parse Preview",
    warnings,
    drafts: items.slice(0, 60),
    confidence: parsed.confidence,
    receiptMeta: parsed.receiptMeta,
  };
}

function isRecoverableQrError(error) {
  if (error?.code === "receipt_qr_not_found" || error?.code === "receipt_qr_unreadable") {
    return true;
  }
  return error?.code === "receipt_qr_decoder_unavailable" && /timed out/i.test(String(error?.message || ""));
}

function receiptOcrNotFoundError() {
  return httpError(
    "QR-код не прочитан, а OCR не смог извлечь фискальные реквизиты. Сфотографируйте нижнюю часть чека крупнее или введите операцию вручную.",
    422,
    "receipt_ocr_not_found"
  );
}

export async function buildReceiptPreview({
  imageFile,
  qrDecoder = decodeReceiptQrFromImage,
  ocrReader = readReceiptOcrText,
}) {
  const imagePayload = {
    imageBuffer: imageFile.buffer,
    filename: imageFile.filename,
    mimeType: imageFile.mimeType,
  };

  let qrFailure = null;
  try {
    const qrPayload = await qrDecoder(imagePayload);

    if (qrPayload) {
      const parsed = parseFiscalQrPayload(qrPayload);
      if (!parsed.ok) {
        throw httpError(parsed.error, 422, parsed.code);
      }
      return buildReceiptPreviewResult(parsed);
    }

    qrFailure = httpError(
      "QR-код чека не распознан. Попробуйте сфотографировать нижнюю часть чека крупнее или введите операцию вручную.",
      422,
      "receipt_qr_not_found"
    );
  } catch (error) {
    if (!isRecoverableQrError(error)) {
      if (error?.statusCode) {
        throw error;
      }
      qrFailure = httpError(
        "QR-код чека не распознан. Попробуйте сфотографировать нижнюю часть чека крупнее или введите операцию вручную.",
        422,
        "receipt_qr_not_found"
      );
    } else {
      qrFailure = error;
    }
  }

  try {
    const ocrResult = await ocrReader(imagePayload);
    if (!ocrResult?.text) {
      throw receiptOcrNotFoundError();
    }

    const parsed = parseFiscalOcrText(ocrResult.text, {
      engine: ocrResult.engine,
      confidence: ocrResult.confidence,
    });
    if (!parsed.ok) {
      throw httpError(parsed.error, 422, parsed.code);
    }

    return buildReceiptPreviewResult(parsed);
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }
    throw receiptOcrNotFoundError();
  }
}
