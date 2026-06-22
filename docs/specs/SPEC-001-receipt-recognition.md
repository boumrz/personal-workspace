# SPEC-001 Receipt Recognition

## Problem Statement

Users can select or capture a receipt photo in the web app. The flow must start
recognition immediately and must never fabricate receipt amounts from filenames
or upload metadata.

## In Scope

- Web data tools receipt tab.
- `POST /api/v2/transactions/receipt/parse` client error handling.
- GigaChat-based receipt image recognition.
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
- Receipt recognition must use GigaChat vision/file attachment flow.
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

This section describes the current LLM fallback contract. The target primary
receipt recognition path is QR-first and is specified in
`docs/specs/SPEC-002-receipt-qr-recognition.md`.

- Provider: GigaChat.
- File upload: upload the image to GigaChat `/files` with `purpose=general`.
- Prompting: pass the uploaded file id as a chat completion attachment.
- Default receipt vision model: `GIGACHAT_VISION_MODEL` or `GigaChat-Pro`.
- Voice assistant GigaChat auth, TLS, timeout, and retry settings are reused.
- Gemini and filename-based fallback are not allowed for this flow.

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
