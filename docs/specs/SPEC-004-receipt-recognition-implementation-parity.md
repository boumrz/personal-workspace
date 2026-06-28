# SPEC-004 Receipt Recognition Implementation And Parity

## Purpose

This spec is the implementation inventory for receipt recognition. Read it
before changing QR recognition, OCR fallback, receipt upload UI, Android data
tools, or release behavior. It exists so future agents do not guess which
capabilities exist.

## Current Architecture

Receipt recognition is server-side and local-first.

```text
web / Android image input
  -> POST /api/v2/transactions/receipt/parse
  -> OpenCV QR decode helper
  -> fiscal QR parser
  -> local Tesseract OCR fallback only when QR is not found/unreadable
  -> review draft response
```

Authoritative files:

- Backend route: `server/src/routes/v2/transactionsParse.js`
- Receipt orchestration: `server/src/services/transactionsDataTools.js`
- Fiscal QR parser: `server/src/services/fiscalQrParser.js`
- QR helper wrapper: `server/src/services/receiptQrDecoder.js`
- QR Python helper: `server/src/services/receipt_qr_decoder.py`
- OCR parser: `server/src/services/fiscalOcrParser.js`
- OCR helper wrapper: `server/src/services/receiptOcrReader.js`
- OCR Python helper: `server/src/services/receipt_ocr_reader.py`
- Runtime dependencies: `server/requirements.txt`
- Web UI: `src/components/TransactionDataTools.tsx`
- Web API client: `src/services/transactionTools.ts`
- Android/native service: `mobile/src/services/receiptImport.ts`
- Android data tools wrapper: `mobile/src/services/dataTools.ts`
- Android screen: `mobile/src/screens/DataToolsScreen.tsx`
- Shared metadata types: `shared/src/types/index.ts`
- Backend receipt tests: `server/test/transactionsParseRoute.test.js`,
  `server/test/fiscalQrParser.test.js`, `server/test/fiscalOcrParser.test.js`
- Mobile service tests: `mobile/src/services/receiptImport.test.ts`
- Web e2e receipt tests: `tests/e2e/voice-assist.spec.ts`

## Implemented Capabilities

- QR payload parsing for Russian fiscal QR fields `t`, `s`, `fn`, `i`, `fp`,
  and `n`.
- OpenCV-based image QR decoding through a Python helper.
- Optional ZXing-C++ decode attempt when the Python package is available.
- QR image preprocessing variants: original, resized, grayscale, lower crop,
  equalized, CLAHE, sharpened, thresholded, and detected QR warps.
- Tesseract OCR fallback through a local Python helper.
- OCR fiscal-field parsing for amount, operation date/time, fiscal drive
  number, fiscal document number, fiscal sign, operation type, and product
  line items when readable.
- Backend rejection instead of draft fabrication when QR/OCR cannot provide
  required image-derived fields.
- Web gallery upload and camera capture file inputs.
- Web auto-analysis immediately after file selection/capture.
- Web retry button only after a failed parse.
- Android native gallery selection and camera capture via Expo ImagePicker.
- Android direct multipart upload to the same backend endpoint.
- Android review/save flow through `DataImportReviewScreen`.
- Non-Android browser bridge fallback for receipt import.

## Explicitly Not Implemented

- No LLM/GigaChat/Gemini receipt image parsing by default.
- No FNS online verification.
- No persistence of fiscal metadata in the database.
- No automatic transaction save after recognition.
- No on-device Android QR/OCR parsing; Android delegates recognition to the
  shared backend.
- No inference from filename, upload id, MIME metadata, or other non-image
  request metadata.

## API Contract

Endpoint:

```text
POST /api/v2/transactions/receipt/parse
Content-Type: multipart/form-data
Authorization: Bearer <token>
Fields:
- file or image: image/*
- locale: ru-RU
- timezone: IANA timezone
```

Response includes both the legacy direct shape and mobile-friendly preview:

```json
{
  "items": [],
  "warnings": [],
  "confidence": 0.98,
  "unparsedText": "",
  "receiptMeta": {
    "source": "qr",
    "fiscalDriveNumber": "8710000100983019",
    "fiscalDocumentNumber": "3647700053",
    "fiscalSign": "13513",
    "operationType": "1",
    "operationDateTime": "2017-12-18T13:12:00",
    "amount": 390
  },
  "preview": {
    "source": "receipt",
    "title": "Receipt Parse Preview",
    "warnings": [],
    "drafts": []
  }
}
```

## Required Behavior

- QR success returns `receiptMeta.source = "qr"` and bypasses OCR.
- QR not found or unreadable may continue to OCR.
- QR decoded but invalid fails with `receipt_qr_invalid`.
- OCR success returns `receiptMeta.source = "ocr"` and includes a warning that
  QR was not read.
- OCR failure returns an actionable error such as `receipt_ocr_not_found`.
- Numeric filenames must not affect amount/date/type.
- Web and Android must show a draft for user review before saving anything.
- Android must support both gallery and camera flows.

## Android Release Rule

For every RuStore-ready Android upload, update together:

- `mobile/package.json` `version`;
- `mobile/package-lock.json` root package version;
- `mobile/app.json` `expo.version`;
- `mobile/app.json` `expo.android.versionCode`.

Current next release after this spec: `1.0.10`, `versionCode: 11`.

## Verification Plan

- `npm --prefix server test`
- `npm run typecheck`
- `npm run build`
- `npm --prefix mobile run test:services`
- `npm --prefix mobile run typecheck`
- Manual Android QA on a physical device:
  - select receipt from gallery;
  - capture receipt from camera;
  - verify upload starts immediately;
  - verify parsed draft opens in review screen;
  - verify server error text is visible when parsing fails.
