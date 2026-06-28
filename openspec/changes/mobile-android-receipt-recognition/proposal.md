## Why

Android users should be able to recognize a receipt from the mobile app with the
same product behavior as the web app: choose or capture a photo, send it to the
shared receipt parser, review the draft, and save it only after confirmation.
The current Android path opens a browser upload bridge, which is less reliable
and does not feel like native mobile parity.

## What Changes

- Add native Android receipt photo selection and camera capture from the mobile
  data tools screen.
- Send the selected image directly from the mobile app to
  `POST /v2/transactions/receipt/parse` as multipart form data.
- Reuse the existing backend QR-first/OCR fallback receipt parser and the
  existing mobile import review/save screen.
- Preserve the web behavior and the browser bridge as a fallback for platforms
  where native image picking is unavailable.
- Show permission, cancellation, upload, and server parse failures inside the
  mobile app without requiring a browser round trip.

## Capabilities

### New Capabilities

- `mobile-android-receipt-recognition`: Native Android receipt operation
  detection parity with the web receipt flow.

### Modified Capabilities

- None. The backend receipt recognition contract remains the one specified by
  `docs/specs/SPEC-001-receipt-recognition.md`,
  `docs/specs/SPEC-002-receipt-qr-recognition.md`, and
  `docs/specs/SPEC-003-receipt-ocr-fallback.md`.

## Impact

- `mobile/src/services/dataTools.ts`: native receipt picker/camera upload path,
  multipart request construction, mobile error mapping.
- `mobile/src/screens/DataToolsScreen.tsx`: Android receipt actions and user
  states.
- `mobile/package.json` and lockfile: native image picker dependency if the
  existing Expo dependency set does not already provide one.
- `mobile/README.md` or environment notes if Android local API/upload behavior
  changes.
- Mobile typecheck and focused service tests cover the new native flow.
