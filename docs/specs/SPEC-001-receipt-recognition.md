# SPEC-001 Receipt Recognition

## Problem Statement

Users can select or capture a receipt photo in the web app. The flow must start
recognition immediately and must never fabricate receipt amounts from filenames
or upload metadata.

## In Scope

- Web data tools receipt tab.
- `POST /api/v2/transactions/receipt/parse` client error handling.
- QR-first receipt image recognition as specified in
  `docs/specs/SPEC-002-receipt-qr-recognition.md`.
- Local OCR fallback for unreadable QR as specified in
  `docs/specs/SPEC-003-receipt-ocr-fallback.md`.
- User-visible retryable error state.
- End-to-end coverage for receipt success and failure paths on desktop and
  mobile web projects.

## Out of Scope

- Changing saved transaction payloads.
- Native Android receipt flow redesign.

## Functional Requirements

- Choosing a receipt image from gallery starts recognition immediately.
- Capturing a receipt image with the camera starts recognition immediately.
- The UI must not show a separate "ready to recognize" intermediate step.
- The recognition button is shown only as a retry action after a failed request.
- Browser WebP receipt images must be converted to PNG before upload when the
  browser supports client-side image decoding.
- Recognition sends the selected image as multipart form data under `file`.
- Successful recognition renders draft operations before anything is saved.
- Failed recognition keeps the selected image available for retry.
- Failed recognition shows a persistent inline error in the receipt tab.
- Receipt recognition must use the local QR-first backend path from
  `docs/specs/SPEC-002-receipt-qr-recognition.md`.
- If QR is missing or unreadable, receipt recognition may use the local OCR
  fallback from `docs/specs/SPEC-003-receipt-ocr-fallback.md`, including printed
  product line items when the item block is readable.
- Receipt amounts, dates, descriptions, and categories must come from receipt
  image content only.
- The backend must not infer receipt amount from filename, upload id, metadata,
  or any other non-image source.
- If no valid amount is visible or returned by the model, the backend must return
  an error instead of a draft operation.
- Error text must prefer server JSON fields in this order: `error`, `message`,
  `detail`.
- If the server does not provide a readable body, the client must include the
  HTTP status code in the fallback error.
- Network failures must be shown as connection errors, not as blank API errors.

## API Contract

Endpoint:

```text
POST /api/v2/transactions/receipt/parse
Content-Type: multipart/form-data
Fields:
- file: image/*
- locale: ru-RU
- timezone: IANA timezone
```

Success response:

```json
{
  "items": [
    {
      "type": "expense",
      "amount": 540,
      "description": "Cafe receipt",
      "categoryHint": "Cafe",
      "categoryResolution": "suggest_create",
      "suggestedCategoryToCreate": "Cafe",
      "date": "2026-03-17"
    }
  ],
  "warnings": [],
  "confidence": 0.89,
  "unparsedText": ""
}
```

Failure response:

```json
{
  "error": "Receipt was analyzed, but no valid amount was found in the image. Please retake the photo with the total amount visible."
}
```

## Provider Contract

The legacy receipt LLM provider path has been removed. Receipt parsing must not
upload receipt images to GigaChat, Gemini, or any other LLM provider. The active
contract is QR-first with local OCR fallback, server-side, and specified in
`docs/specs/SPEC-002-receipt-qr-recognition.md` and
`docs/specs/SPEC-003-receipt-ocr-fallback.md`.

- Primary path: local QR decoding.
- Fallback path: local OCR of printed fiscal fields when QR is not decoded.
- Backend implementation: OpenCV/Tesseract helpers invoked by the Node/Express endpoint.
- Filename-based fallback is not allowed.
- LLM fallback for receipt images is not allowed by default or as an automatic
  retry path.

## UX States

- Empty: show instruction to choose or capture a receipt image.
- Loading: after choose/capture, show recognition progress immediately and
  disable receipt actions while the request is in progress.
- Success: show drafts and warnings, if any.
- Error: show persistent inline alert with exact actionable error and keep retry
  available.

## Security

- Do not expose provider keys or raw upstream responses.
- Keep upload size/type validation on the backend.
- Do not save parsed drafts until the user confirms.

## Acceptance Criteria

- Mobile web users can always read why receipt recognition failed.
- A failed request does not clear the selected file.
- Retrying after a failed request is possible without selecting the file again.
- Selecting or capturing a file sends one parse request without pressing an
  additional recognition button.
- Numeric filenames such as `1000014568.webp` must never become transaction
  amounts.
- E2E tests cover success, server JSON error, and generic HTTP error fallback.

## Verification Plan

- `npm run typecheck`
- `npm --prefix mobile run typecheck`
- Targeted Playwright:
  `npx playwright test tests/e2e/voice-assist.spec.ts -g "receipt"`
- Full e2e before release when practical: `npm run test:e2e`

## Agents

- Specification agent: defines this receipt flow contract.
- Web agent: owns web UI and client API behavior.
- Backend agent: owns `/api/v2/transactions/receipt/parse`.
- Autotest agent: owns Playwright regression coverage.
- QA agent: validates desktop and mobile web behavior.
