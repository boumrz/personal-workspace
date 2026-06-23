# SPEC-002 Receipt QR Recognition

## Problem Statement

Receipt recognition must become cheap, deterministic, and local-first. Vision
LLM parsing is too expensive for the primary path and can hallucinate fields.
For fiscal receipts, the first recognition path must decode the receipt QR code
and extract the operation draft from fiscal fields before trying OCR or LLM
fallbacks.

## Goals

- Reduce token/API usage for receipt recognition to zero on QR-readable checks.
- Extract amount, operation date, and operation type from QR payload with
  deterministic parsing.
- Keep all parsing self-hosted or based on free/open-source libraries.
- Preserve the existing user flow: choose/capture receipt -> analyze
  immediately -> review draft -> save explicitly.
- Make failures actionable: no fake drafts when QR is missing, damaged, or
  incomplete.

## Non-Goals

- No paid OCR or LLM dependency in the primary QR path.
- No automatic transaction saving without user confirmation.
- No mandatory FNS API dependency for MVP. FNS verification can be an optional
  later validation layer because it requires registration/token handling and has
  usage conditions.
- No full line-item extraction from QR alone. QR is enough for fiscal metadata
  and total, not a reliable product list.

## Scope

- Web receipt flow in `src/components/TransactionDataTools.tsx`.
- Mobile/web-app receipt upload path where it reuses the same backend endpoint.
- Backend endpoint `POST /api/v2/transactions/receipt/parse`.
- Shared response contract for parsed transaction drafts.
- Tests for QR decode, QR payload parsing, fallback behavior, and e2e receipt
  flow.

## Proposed Architecture

```text
User image/camera
  -> client-side normalization (resize/rotate/webp->png when needed)
  -> backend receipt parser
  -> QR decoder chain
       1. decode original image
       2. decode grayscale/contrast variants
       3. decode cropped/lower-half variants
  -> fiscal QR parser
  -> draft transaction response
  -> OCR fallback for unreadable/missing QR
       (specified in docs/specs/SPEC-003-receipt-ocr-fallback.md)
```

## Library Choices

Primary web/client candidate:

- `@zxing/browser` or `@zxing/library`
- Reason: free, browser-friendly, TypeScript-compatible, can decode QR from
  image/video/canvas and can reduce backend work.

Primary backend choice:

- Python sidecar or backend worker with OpenCV `QRCodeDetector`.
- Reason: receipt photos are often angled, blurred, cropped, or low-contrast;
  OpenCV gives direct control over preprocessing, perspective handling, and
  multi-pass decode attempts.

Secondary decoder:

- `pyzbar` can be used as an optional second decoder after OpenCV preprocessing
  if OpenCV detects the QR region but cannot decode payload reliably.

Web/client candidate:

- `@zxing/browser` can be used later as a convenience pre-check, but it is not
  the MVP source of truth. Backend OpenCV result wins.

Recommended MVP choice:

- Use OpenCV first from the beginning.
- Keep the Node/Express endpoint as the public API boundary.
- Execute QR decoding in a Python helper process or local sidecar module called
  by the backend.
- Keep the helper stateless: input image bytes -> decoded payload or structured
  failure.

## Fiscal QR Payload Contract

The parser must accept QR payloads as URL/query-like strings, for example:

```text
t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1
```

Required fields for a valid QR draft:

- `t`: operation date/time.
- `s`: total amount.
- `fn`: fiscal storage number.
- `i`: fiscal document number.
- `fp`: fiscal sign.
- `n`: operation type.

Supported date formats:

- `YYYYMMDDTHHmm`
- `YYYYMMDDTHHmmss`
- `YYYY-MM-DDTHH:mm:ss` when encountered in decoded payloads.

Operation type mapping:

- `n=1`: expense, sale/income receipt from merchant perspective.
- `n=2`: income/refund for user, refund of sale.
- `n=3`: income/expense-out receipt; keep as `expense` only if product decision
  confirms this use case.
- `n=4`: expense/refund-out receipt; keep conservative and mark warning.

For MVP:

- `n=1` creates an `expense` draft.
- `n=2` creates an `income` draft with warning `Возврат прихода`.
- Unknown `n` returns no draft and shows an actionable error.

## Response Contract

Endpoint remains:

```text
POST /api/v2/transactions/receipt/parse
Content-Type: multipart/form-data
Fields:
- file: image/*
- locale: ru-RU
- timezone: IANA timezone
```

Successful QR response:

```json
{
  "items": [
    {
      "type": "expense",
      "amount": 390,
      "description": "Чек ФН 8710000100983019",
      "categoryHint": "Другое",
      "categoryResolution": "suggest_create",
      "suggestedCategoryToCreate": "Другое",
      "date": "2017-12-18",
      "confidence": 0.98
    }
  ],
  "confidence": 0.98,
  "warnings": [],
  "unparsedText": "",
  "receiptMeta": {
    "source": "qr",
    "qrPayload": "t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1",
    "fiscalDriveNumber": "8710000100983019",
    "fiscalDocumentNumber": "3647700053",
    "fiscalSign": "13513",
    "operationType": "1",
    "operationDateTime": "2017-12-18T13:12:00",
    "amount": 390
  }
}
```

Failure response when QR cannot be decoded:

```json
{
  "error": "QR-код чека не распознан. Попробуйте сфотографировать нижнюю часть чека крупнее или введите операцию вручную.",
  "code": "receipt_qr_not_found"
}
```

Failure response when QR is decoded but invalid:

```json
{
  "error": "QR-код найден, но в нем нет обязательных реквизитов суммы или фискального документа.",
  "code": "receipt_qr_invalid"
}
```

## Backend Requirements

- Validate uploaded file type and size before image decoding.
- Never infer amount/date/type from filename or metadata.
- Decode QR from at least these image variants:
  - original image;
  - normalized orientation;
  - grayscale;
  - contrast/sharpened;
  - lower-half crop, because QR is usually near the receipt bottom.
- Parse QR payload with `URLSearchParams`-style semantics and tolerate:
  - uppercase/lowercase keys;
  - extra unknown keys;
  - URL-encoded values;
  - comma or dot as decimal separator in `s`.
- Reject payloads with missing `s`, `t`, `fn`, `i`, `fp`, or `n`.
- Amount must be finite and greater than zero.
- Date must become ISO `YYYY-MM-DD` for transaction drafts.
- Store full fiscal metadata only in response metadata for now; do not persist it
  until a database migration is specified.
- Return confidence:
  - `0.98` when QR has all required fields and amount/date/type parse cleanly;
  - `0.75` when QR is valid but has warnings;
  - no draft on invalid QR.

## Frontend Requirements

- Keep current automatic analyze-on-select behavior.
- Show progress as soon as user chooses/captures an image.
- If QR success returns one draft, show draft review immediately.
- If QR failure returns `receipt_qr_not_found`, show specific instruction:
  "Сфотографируйте нижнюю часть чека крупнее".
- Do not show filename as a signal for parsed values.
- Keep retry action after failures.
- Do not ask the user to press a separate "Recognize" button after selecting a
  photo.

## Fallback Policy

Implemented fallback:

- QR decode succeeds -> parse QR and skip OCR.
- QR is not found or is detected but unreadable -> run local OCR fallback from
  `docs/specs/SPEC-003-receipt-ocr-fallback.md`.
- QR is decoded but invalid -> return `receipt_qr_invalid`; do not override
  structured QR data with noisier OCR.
- OCR fails -> show actionable error and keep retry/manual entry available.

- LLM fallback only behind an explicit env flag, for diagnostics or premium
  flows, never as default.

Feature flags:

```text
RECEIPT_RECOGNITION_MODE=qr_ocr
RECEIPT_QR_DECODER=opencv
RECEIPT_ENABLE_OCR_FALLBACK=true
RECEIPT_ENABLE_LLM_FALLBACK=false
```

## FNS Verification Optional Extension

The QR payload can later be used to verify the check against FNS services, but
this is not part of MVP.

Reasons:

- FNS Open API requires registration and token handling.
- API availability and rate limits must not block local receipt entry.
- Verification is useful for trust, but not required to create a user-reviewed
  finance draft.

If added later, FNS status must be metadata/warning, not a reason to fabricate
or overwrite user data.

## Security And Privacy

- Receipt images can contain personal data; process in memory and do not log raw
  images.
- Do not log full QR payload in production logs unless debug mode is enabled.
- Do not persist fiscal metadata until a retention policy is specified.
- Keep upload limits and rate limits.
- Avoid external calls in MVP; QR decoding must work offline/server-local.

## Acceptance Criteria

- A QR-readable receipt creates one transaction draft without any LLM call.
- The draft amount equals QR field `s`.
- The draft date equals QR field `t` converted to `YYYY-MM-DD`.
- A receipt filename like `1000014568.webp` never affects amount or date.
- Missing QR returns `receipt_qr_not_found` and no draft.
- Invalid QR returns `receipt_qr_invalid` and no draft.
- Existing receipt e2e success/error tests remain green.
- New tests cover QR parsing with the sample payload:
  `t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1`.

## Test Plan

Unit tests:

- `parseFiscalQrPayload` parses amount/date/fiscal fields.
- Decimal comma and decimal dot are supported.
- Missing required fields are rejected.
- Operation type mapping is deterministic.
- Numeric filenames are ignored.

Backend integration tests:

- Multipart image containing QR returns a draft.
- Non-image upload returns 400.
- Image without QR returns `receipt_qr_not_found`.
- Decoded invalid QR returns `receipt_qr_invalid`.

E2E tests:

- Web/mobile-web: select/capture QR receipt -> auto-analysis -> draft shown.
- Error path: no QR -> persistent inline error -> retry available.
- WebP upload path remains covered.

Manual QA:

- Test printed receipt photo.
- Test screenshot of electronic receipt.
- Test angled/blurred photo.
- Test receipt where QR is only partially visible.

## Implementation Steps

1. Add QR parser module with no image dependencies:
   `parseFiscalQrPayload(payload)`.
2. Add OpenCV-based QR image decoder helper/service.
3. Wire decoder into `/api/v2/transactions/receipt/parse` before any OCR/LLM
   fallback.
4. Return QR metadata in response.
5. Update UI copy for QR-specific errors.
6. Add unit/backend/e2e tests.
7. Make LLM fallback disabled by default.
8. Collect a small local fixture set of real receipt images for regression.

## Owner Agents

- Specification agent: owns this contract.
- Backend agent: owns QR parser, image decoder, endpoint behavior.
- Web agent: owns receipt flow UI and error copy.
- Mobile agent: verifies mobile-web/native upload compatibility.
- Autotest agent: owns unit/integration/e2e coverage.
- QA agent: validates real receipt photo fixtures.
- Security-devops agent: checks upload limits, logging, and external-call
  feature flags.

## References

- FNS check verification service and Open API: https://kkt-online.nalog.ru/
- FNS Open API terms: https://kkt-online.nalog.ru/ap-description/
- ZXing browser package: https://www.npmjs.com/package/@zxing/browser
- ZXing TypeScript examples: https://zxing-js.github.io/library/
- OpenCV QRCodeDetector reference: https://docs.opencv.org/
