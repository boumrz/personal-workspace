const OCR_NOT_FOUND_ERROR =
  "QR-код не прочитан, а OCR не смог извлечь фискальные реквизиты. Сфотографируйте нижнюю часть чека крупнее или введите операцию вручную.";

const OCR_CONFIDENCE = 0.72;

const PRODUCT_LINE_PATTERN =
  /(\d+[.,]\d{3}|\d+)\s*(?:шт\.?|ш\.|wi\.?)\s*[xх×*]\s*(\d+[.,]\d{2})\s*=\s*(\d{1,7}(?:[.,]\d{2})?)/i;

const PRODUCT_NAME_SKIP_PATTERN =
  /^(кассов|продаж|смен|ит[о0u]г|сумм|безнал|налич|накопл|начисл|баланс|бонус|ип |ооо |оао |www\.|nalog|рн\s*ккт|зн\s*ккт|фн|фд|фп|инн|сн[оo]|чек\s*№|чек\s*n|приход|возврат)/i;

const FISCAL_OR_ADDRESS_PATTERN =
  /ккт|фн|фд|фп|инн|смен|чек\s*№|чек\s*n|рн\s|зн\s|сн[оo]|www\.|nalog|117\d{3}|варшав|москв|улиц|просп|шоссе|дом|стр\.?/i;

const DIGIT_CONFUSIONS = new Map([
  ["O", "0"],
  ["o", "0"],
  ["О", "0"],
  ["о", "0"],
  ["Q", "0"],
  ["D", "0"],
  ["U", "0"],
  ["u", "0"],
  ["I", "1"],
  ["l", "1"],
  ["|", "1"],
  ["!", "1"],
  ["i", "1"],
  ["З", "3"],
  ["з", "3"],
  ["S", "5"],
  ["s", "5"],
  ["б", "6"],
  ["Б", "6"],
]);

function notFound(error = OCR_NOT_FOUND_ERROR) {
  return {
    ok: false,
    code: "receipt_ocr_not_found",
    error,
  };
}

function linesFromText(text) {
  return String(text || "")
    .replace(/\uFEFF/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeDigitText(value) {
  return String(value || "")
    .split("")
    .map((char) => DIGIT_CONFUSIONS.get(char) || char)
    .join("");
}

function digitsOnly(value) {
  return normalizeDigitText(value).replace(/\D/g, "");
}

function parseAmountToken(token) {
  const normalized = normalizeDigitText(token).replace(/\s+/g, "").replace(",", ".");
  const decimalMatch = normalized.match(/^(\d{1,7})\.(\d{1,2})$/);
  if (decimalMatch) {
    const amount = Number(`${decimalMatch[1]}.${decimalMatch[2].padEnd(2, "0")}`);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  const integerMatch = normalized.match(/^(\d{1,7})$/);
  if (!integerMatch) return null;
  const amount = Number(integerMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function parseQuantityToken(token) {
  const normalized = normalizeDigitText(token).replace(/\s+/g, "").replace(",", ".");
  const match = normalized.match(/^(\d+)(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return Math.round((quantity + Number.EPSILON) * 1000) / 1000;
}

function amountsRoughlyEqual(left, right) {
  return Math.abs(left - right) < 0.01;
}

function amountLineScore(line) {
  const normalized = line.toLowerCase();
  let score = 0;
  if (/ит[о0u]г|иго|итoг/.test(normalized)) score += 100;
  if (/безнал|налич|карт|оплат/.test(normalized)) score += 70;
  if (/сумм.*без\s*ндс/.test(normalized)) score += 65;
  if (line.includes("=")) score += 40;
  if (PRODUCT_LINE_PATTERN.test(line)) score += 55;
  if (FISCAL_OR_ADDRESS_PATTERN.test(line)) score -= 200;
  if (/ккт|фн|фд|фп|инн|смен|чек\s*№|чек n/i.test(line)) score -= 120;
  return score;
}

function extractAmountCandidates(lines) {
  const candidates = [];
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase();
    const isItog = /ит[о0u]г|иго|итoг/.test(normalized);
    const isPaymentTotal = /безнал|налич|карт|оплат|сумм.*без\s*ндс/.test(normalized);
    const isProductLine = PRODUCT_LINE_PATTERN.test(line);
    const dateLikeLine = /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\s+\d{1,2}[:.]\d{2}\b/.test(
      normalizeDigitText(line)
    );
    const tokens =
      line.match(/[0-9OoОоQDUuIl|!iЗзSsбБ]{1,7}[\s.,]+[0-9OoОоQDUuIl|!iЗзSsбБ]{1,2}(?![0-9OoОоQDUuIl|!iЗзSsбБ])/g) ||
      [];

    for (const token of tokens) {
      if (dateLikeLine && !isItog && !isPaymentTotal && !isProductLine) continue;
      const amount = parseAmountToken(token);
      if (amount === null) continue;
      candidates.push({
        amount,
        score: amountLineScore(line) - index / 100,
        isItog,
        isPaymentTotal,
        isProductLine,
        line,
      });
    }
  });

  candidates.sort((left, right) => right.score - left.score);
  return candidates;
}

function sumLineTotals(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return null;
  const total = lineItems.reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function reconcileAmount(lines, lineItems) {
  const candidates = extractAmountCandidates(lines);
  const productTotal = sumLineTotals(lineItems);
  const warnings = [];

  if (productTotal === null) {
    return {
      amount: candidates[0]?.amount ?? null,
      warnings,
    };
  }

  const agreesWithProducts = (amount) => amountsRoughlyEqual(amount, productTotal);
  const topCandidate = candidates[0];

  if (topCandidate && !agreesWithProducts(topCandidate.amount)) {
    const supporting = candidates.filter(
      (candidate) =>
        agreesWithProducts(candidate.amount) &&
        (candidate.isPaymentTotal || candidate.isProductLine || /=\s*\d/.test(candidate.line))
    );

    if (supporting.length > 0) {
      warnings.push("Сумма скорректирована по товарным позициям чека.");
      return { amount: productTotal, warnings };
    }
  }

  if (!candidates.some((candidate) => agreesWithProducts(candidate.amount))) {
    warnings.push("Сумма восстановлена по товарным позициям чека.");
    return { amount: productTotal, warnings };
  }

  return {
    amount: topCandidate?.amount ?? productTotal,
    warnings,
  };
}

function isReadableProductName(line) {
  const text = String(line || "").trim();
  if (!text || text.length < 2) return false;
  if (PRODUCT_NAME_SKIP_PATTERN.test(text)) return false;
  if (FISCAL_OR_ADDRESS_PATTERN.test(text)) return false;
  if (/^\d+[.,\d\s]*$/.test(text)) return false;
  if (PRODUCT_LINE_PATTERN.test(text)) return false;
  return /[A-Za-zА-Яа-яЁё]/.test(text);
}

function extractProductLines(lines) {
  const items = [];

  lines.forEach((line, index) => {
    const match = line.match(PRODUCT_LINE_PATTERN);
    if (!match) return;

    const quantity = parseQuantityToken(match[1]);
    const unitPrice = parseAmountToken(match[2]);
    const parsedLineTotal = parseAmountToken(match[3]);
    if (parsedLineTotal === null) return;

    const lineTotal =
      quantity !== null && unitPrice !== null && Math.abs(quantity - 1) < 0.001
        ? unitPrice
        : parsedLineTotal;

    let name = "";
    for (let offset = 1; offset <= 2; offset += 1) {
      const candidate = lines[index - offset];
      if (!isReadableProductName(candidate)) continue;
      name = String(candidate).trim().slice(0, 80);
      break;
    }

    items.push({
      name,
      ...(quantity !== null ? { quantity } : {}),
      ...(unitPrice !== null ? { unitPrice } : {}),
      lineTotal,
    });
  });

  return items;
}

function buildReceiptDescription(lineItems, fiscalDriveNumber) {
  const names = lineItems.map((item) => item.name).filter(Boolean);
  if (names.length > 0) {
    return names.join(", ").slice(0, 160);
  }
  return `Чек ФН ${fiscalDriveNumber}`;
}

function parseFiscalDateTimeParts(rawDay, rawMonth, rawYear, rawHour, rawMinute) {
  const day = Number(rawDay);
  const month = Number(rawMonth);
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  ) {
    return null;
  }

  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return {
    date: `${yyyy}-${mm}-${dd}`,
    dateTime: `${yyyy}-${mm}-${dd}T${hh}:${min}:00`,
  };
}

function extractOperationDateTime(text) {
  const normalized = normalizeDigitText(text);
  const match = normalized.match(/\b(\d{2})[.\-/](\d{2})[.\-/](\d{2}|\d{4})\s+(\d{1,2})[:.](\d{2})\b/);
  if (!match) return null;
  return parseFiscalDateTimeParts(match[1], match[2], match[3], match[4], match[5]);
}

function lineHasLabel(line, labels) {
  const normalized = line.toUpperCase();
  return labels.some((label) => normalized.includes(label));
}

function collectNumericCandidates(lines, labels, { minLength, maxLength, trimLeadingZeros = false } = {}) {
  const candidates = [];
  lines.forEach((line, index) => {
    if (!lineHasLabel(line, labels)) return;
    const chunks = line.match(/[0-9OoОоQDUuIl|!iЗзSsбБ\s]{4,}/g) || [];
    for (const chunk of chunks) {
      let digits = digitsOnly(chunk);
      if (trimLeadingZeros) {
        digits = digits.replace(/^0+/, "");
      }
      if (digits.length >= minLength && digits.length <= maxLength) {
        candidates.push({ value: digits, index });
      }
      if (digits.length > maxLength) {
        const tail = digits.slice(-maxLength);
        if (tail.length >= minLength) {
          candidates.push({ value: trimLeadingZeros ? tail.replace(/^0+/, "") : tail, index: index + 0.1 });
        }
      }
    }
  });
  candidates.sort((left, right) => left.index - right.index);
  return candidates.map((candidate) => candidate.value).filter(Boolean);
}

function extractFiscalDriveNumber(lines) {
  const labeled = collectNumericCandidates(lines, ["ФН", "FN"], { minLength: 14, maxLength: 16 });
  if (labeled[0]) return labeled[0].padStart(16, "0").slice(-16);

  const fallback = [];
  lines.forEach((line, index) => {
    const chunks = line.match(/[0-9OoОоQDUuIl|!iЗзSsбБ\s]{14,}/g) || [];
    for (const chunk of chunks) {
      const digits = digitsOnly(chunk);
      if (digits.length >= 16 && digits.includes("738")) {
        fallback.push({ value: digits.slice(0, 16), index });
      }
    }
  });
  fallback.sort((left, right) => left.index - right.index);
  return fallback[0]?.value ?? "";
}

function extractFiscalDocumentNumber(lines) {
  const candidates = collectNumericCandidates(lines, ["ФД", "FD"], {
    minLength: 1,
    maxLength: 12,
    trimLeadingZeros: true,
  });
  if (candidates[0]) return candidates[0];

  const zeroRunCandidates = [];
  lines.forEach((line, index) => {
    if (/сумм|безнал|налич|кассов|продаж|1[.,]000|x|х/i.test(line)) return;
    const digits = digitsOnly(line);
    const match = digits.match(/0{4,}(\d{3,8})/);
    if (match?.[1]) {
      zeroRunCandidates.push({ value: match[1], index });
    }
  });
  zeroRunCandidates.sort((left, right) => left.index - right.index);
  if (zeroRunCandidates[0]) return zeroRunCandidates[0].value;

  const loose = collectNumericCandidates(lines, ["000000"], {
    minLength: 1,
    maxLength: 12,
    trimLeadingZeros: true,
  });
  return loose[0] || "";
}

function extractFiscalSign(lines) {
  const candidates = collectNumericCandidates(lines, ["ФП", "ФР", "FP"], {
    minLength: 8,
    maxLength: 12,
  });
  if (candidates[0]) return candidates[0];

  const loose = collectNumericCandidates(lines, ["ON:", "91:"], {
    minLength: 8,
    maxLength: 12,
  });
  return loose[0] || "";
}

function extractOperationType(text) {
  const normalized = text.toUpperCase();
  if (/ВОЗВРАТ\s+ПРИХОД/.test(normalized)) return "2";
  if (/ПРИХОД|ПРОДАЖ|ПРОЦАЖ|PHXO|PRIHOD/.test(normalized)) return "1";
  return "";
}

export function parseFiscalOcrText(text, { engine = "unknown" } = {}) {
  const sourceText = String(text || "");
  const lines = linesFromText(sourceText);
  const lineItems = extractProductLines(lines);
  const { amount, warnings: amountWarnings } = reconcileAmount(lines, lineItems);
  const operationDateTime = extractOperationDateTime(sourceText);
  const fiscalDriveNumber = extractFiscalDriveNumber(lines);
  const fiscalDocumentNumber = extractFiscalDocumentNumber(lines);
  const fiscalSign = extractFiscalSign(lines);
  const operationType = extractOperationType(sourceText);

  if (
    amount === null ||
    !operationDateTime ||
    !fiscalDriveNumber ||
    !fiscalDocumentNumber ||
    !fiscalSign ||
    !operationType
  ) {
    return notFound();
  }

  const type = operationType === "2" ? "income" : "expense";
  const warnings = ["QR-код не прочитан, реквизиты извлечены OCR."];
  if (operationType === "2") {
    warnings.push("Возврат прихода");
  }
  warnings.push(...amountWarnings);

  const description = buildReceiptDescription(lineItems, fiscalDriveNumber);

  return {
    ok: true,
    item: {
      type,
      amount,
      description,
      categoryHint: "Другое",
      categoryResolution: "suggest_create",
      suggestedCategoryToCreate: "Другое",
      date: operationDateTime.date,
      confidence: OCR_CONFIDENCE,
    },
    confidence: OCR_CONFIDENCE,
    warnings,
    receiptMeta: {
      source: "ocr",
      ocrEngine: engine,
      fiscalDriveNumber,
      fiscalDocumentNumber,
      fiscalSign,
      operationType,
      operationDateTime: operationDateTime.dateTime,
      amount,
      ...(lineItems.length > 0 ? { lineItems } : {}),
    },
  };
}
