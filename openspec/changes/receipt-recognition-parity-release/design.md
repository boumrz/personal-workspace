## Current Implementation Inventory

The receipt analyzer is server-side and local-first:

- Public endpoint: `POST /api/v2/transactions/receipt/parse`.
- Backend route: `server/src/routes/v2/transactionsParse.js`.
- Receipt orchestration: `server/src/services/transactionsDataTools.js`.
- QR payload parser: `server/src/services/fiscalQrParser.js`.
- QR image decoder wrapper: `server/src/services/receiptQrDecoder.js`.
- QR image decoder helper: `server/src/services/receipt_qr_decoder.py`.
- OCR parser: `server/src/services/fiscalOcrParser.js`.
- OCR helper wrapper: `server/src/services/receiptOcrReader.js`.
- OCR helper: `server/src/services/receipt_ocr_reader.py`.
- Python dependencies: `server/requirements.txt`.
- Web UI: `src/components/TransactionDataTools.tsx`.
- Web client API: `src/services/transactionTools.ts`.
- Android/native service: `mobile/src/services/receiptImport.ts` and
  `mobile/src/services/dataTools.ts`.
- Android screen: `mobile/src/screens/DataToolsScreen.tsx`.
- Shared metadata types: `shared/src/types/index.ts`.

## Behavior Contract

The backend is the source of truth for recognition. It first tries OpenCV-based
QR decoding, then local Tesseract OCR only when QR is not found or is
unreadable. Decoded but invalid QR payloads are hard errors and must not be
silently replaced by OCR. Receipt images must not be sent to LLM providers by
default, and filename/upload metadata must never be used for amount/date/type.

The web app and Android app must both:

- allow choosing an existing receipt photo;
- allow capturing a new photo;
- start analysis immediately after image selection/capture;
- show a loading state during upload/parse;
- show parsed drafts for explicit user review;
- save only after user confirmation;
- surface server error text and allow retry/manual recovery.

Android implements native gallery/camera input through Expo ImagePicker and
sends multipart form data directly to the same backend endpoint. Non-Android
platforms may keep the browser bridge fallback.

## Versioning

For RuStore/Android uploads, each releasable build must increment both:

- `mobile/package.json` `version`;
- `mobile/app.json` `expo.version`;
- `mobile/app.json` `expo.android.versionCode`.

The package lock root version must match `mobile/package.json`.

## Risks

- Local OCR depends on Python packages and the Tesseract binary; tests can fail
  on machines without the native runtime.
- Android camera/gallery behavior needs a real device or emulator for final QA.
- EAS cloud builds require authenticated Expo/EAS credentials and may not be
  possible from every local shell.
