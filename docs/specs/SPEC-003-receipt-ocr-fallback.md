# SPEC-003 Receipt OCR Fallback

## Problem Statement

Some fiscal receipts contain a QR code that is visible and detectable but cannot
be decoded because of damaged printing, perspective distortion, overlapping
text, glare, or missing quiet zone. In these cases the receipt often still shows
the fiscal fields as printed text. The backend needs a local OCR fallback that
extracts those fields without using an LLM or any external OCR API.

## Goals

- Keep receipt image recognition cheap and local when QR decoding fails.
- Extract enough fiscal fields from printed receipt text to create a reviewed
  transaction draft.
- Preserve QR-first behavior: QR is still preferred when it decodes cleanly.
- Avoid fabricating data: OCR drafts require explicit amount, date/time, fiscal
  drive number, fiscal document number, fiscal sign, and operation type.
- Make OCR provenance visible in response metadata.

## Non-Goals

- No paid OCR, cloud OCR, or LLM fallback for receipt images.
- No database persistence of OCR text or fiscal metadata.
- No FNS verification.
- No automatic save without user review.

## Recognition Order

```text
Receipt image
  -> QR decoder
       -> success: parse fiscal QR payload
       -> not_found/unreadable: continue
       -> invalid decoded QR: stop with receipt_qr_invalid
  -> local OCR fallback
       -> success: parse printed fiscal fields
       -> unavailable/not enough fields: return actionable QR/OCR error
```

OCR fallback is attempted only after QR cannot be decoded or the QR is detected
but unreadable. A decoded but invalid QR remains a hard error because it is
structured data and should not be silently overridden by noisier OCR.

## OCR Engine Contract

The OCR engine must be local and invoked by the backend as a stateless helper:

```text
input: image bytes on stdin
output: JSON on stdout
```

Successful helper response:

```json
{
  "ok": true,
  "text": "raw OCR text",
  "engine": "tesseract",
  "confidence": 0.72
}
```

Recoverable helper response:

```json
{
  "ok": false,
  "code": "receipt_ocr_not_found",
  "error": "Не удалось прочитать фискальные реквизиты чека."
}
```

Unavailable helper response:

```json
{
  "ok": false,
  "code": "receipt_ocr_unavailable",
  "statusCode": 503
}
```

The first implementation may use Tesseract through `pytesseract`. The backend
must not call any external network service for OCR.

## Printed Fiscal Fields

The parser must recognize common Russian fiscal receipt labels and noisy OCR
variants:

- operation date/time: `ДД.ММ.ГГ ЧЧ:ММ`, `ДД.ММ.ГГГГ ЧЧ:ММ`;
- amount: `ИТОГ`, `Итог`, `Сумма`, paid-by-cash/card total;
- fiscal drive number: `ФН`, OCR-confused variants such as `ФН N`;
- fiscal document number: `ФД`, `ФД N`, `ФД №`;
- fiscal sign: `ФП`, `ФПД`, `ФП N`;
- operation type:
  - `ПРИХОД` -> `n=1`;
  - `ВОЗВРАТ ПРИХОДА` -> `n=2`.

## Printed Product Line Items

When OCR text contains a tabular item block, the parser must also extract
product lines in the common Russian receipt format:

- product name on the line above the quantity/price row;
- quantity in pieces: `1.000 шт.`;
- unit price and line total: `1.000 шт. x 300.00 = 300.00`.

Each parsed line item must expose:

- `name`: trimmed product title, up to 80 characters;
- `quantity`: decimal quantity when present;
- `unitPrice`: per-item price when present;
- `lineTotal`: line amount, required when the row is recognized.

The parser must not treat fiscal identifiers, merchant address, INN, or bonus
balances as receipt totals when product lines provide a consistent total.

### Amount Reconciliation

When product lines are present:

- the sum of `lineTotal` values is a strong signal for the receipt amount;
- if `ИТОГ` or another total line disagrees with that sum, but payment totals
  such as `БЕЗНАЛИЧНЫМИ` or `СУММА БЕЗ НДС` agree with the product-line sum,
  the parser must prefer the product-line sum;
- when the amount is corrected this way, add a warning such as
  `Сумма скорректирована по товарным позициям чека.`

### Draft Description

When at least one product line has a readable name, the draft description must
use the joined product names (comma-separated, up to 160 characters). Otherwise
the parser keeps the fiscal fallback description `Чек ФН <fiscalDriveNumber>`.

The parser may normalize common OCR confusions in numeric fields, for example
`O -> 0`, `З -> 3`, `б -> 6`, `I/l -> 1`, but only inside values that are
expected to be numeric.

## Response Contract

OCR success uses the same endpoint:

```text
POST /api/v2/transactions/receipt/parse
```

Successful OCR response:

```json
{
  "items": [
    {
      "type": "expense",
      "amount": 300,
      "description": "Флэт Уайт 350 мл",
      "categoryHint": "Другое",
      "categoryResolution": "suggest_create",
      "suggestedCategoryToCreate": "Другое",
      "date": "2026-06-22",
      "confidence": 0.72
    }
  ],
  "confidence": 0.72,
  "warnings": ["QR-код не прочитан, реквизиты извлечены OCR."],
  "unparsedText": "",
  "receiptMeta": {
    "source": "ocr",
    "ocrEngine": "tesseract",
    "fiscalDriveNumber": "7382440300255976",
    "fiscalDocumentNumber": "5201",
    "fiscalSign": "1424567415",
    "operationType": "1",
    "operationDateTime": "2026-06-22T10:50:00",
    "amount": 300,
    "lineItems": [
      {
        "name": "Флэт Уайт 350 мл",
        "quantity": 1,
        "unitPrice": 300,
        "lineTotal": 300
      }
    ]
  }
}
```

Failure after QR and OCR both fail:

```json
{
  "error": "QR-код не прочитан, а OCR не смог извлечь фискальные реквизиты. Сфотографируйте нижнюю часть чека крупнее или введите операцию вручную.",
  "code": "receipt_ocr_not_found"
}
```

## Backend Requirements

- QR success must bypass OCR.
- OCR fallback must run only for `receipt_qr_not_found` and
  `receipt_qr_unreadable`.
- OCR unavailable must not become a 500. If QR failed and OCR is unavailable,
  return an actionable 422 error unless the helper itself crashed unexpectedly.
- OCR parser must reject drafts when any required field is missing or invalid.
- Amount must be finite and greater than zero.
- Date/time must be valid and normalized to ISO date/time.
- OCR confidence for a complete fiscal-field parse starts at `0.72`.
- OCR success must include a warning that QR was not read.
- The backend must not infer values from filename or upload metadata.

## Frontend Requirements

- Existing receipt UI remains unchanged for successful OCR: show the draft just
  like QR success.
- If OCR also fails, show server error text inline and keep retry available.
- Metadata source can be shown later, but this slice only requires that the API
  contract exposes `receiptMeta.source = "ocr"`.

## Acceptance Criteria

- A QR-readable receipt still returns `receiptMeta.source = "qr"`.
- A receipt with unreadable QR but visible printed fiscal fields returns one
  draft with `receiptMeta.source = "ocr"`.
- The OCR fallback extracts amount, date, fiscal drive number, fiscal document
  number, fiscal sign, operation type, and product line items from image text
  only when the item block is readable.
- When OCR misreads `ИТОГ` but product lines and payment totals agree on the
  same amount, the returned draft uses the reconciled amount instead of the noisy
  total line.
- A receipt image with neither readable QR nor required OCR fields returns
  `receipt_ocr_not_found` and no draft.
- OCR is covered by backend integration tests using real receipt fixtures.
- Web e2e covers an OCR-sourced draft in the receipt review flow.

## Verification Plan

- `RECEIPT_QR_PYTHON=<venv>/bin/python npm --prefix server test`
- `npm run typecheck`
- `npm run build`
- `RECEIPT_QR_PYTHON=<venv>/bin/python npm run test:e2e`
