## Context

The web receipt flow already uploads an image directly to the shared backend
receipt endpoint, receives transaction drafts, and shows an editable review
before saving. The Android mobile screen currently starts the same backend flow
through a generated browser upload page and deep link callback. That workaround
avoids native picker dependencies, but it is fragile for local/LAN testing,
requires app switching, and does not match web product behavior.

The backend receipt parser remains the single source of recognition behavior:
QR-first decoding, local OCR fallback, no LLM image parsing, and the existing
`TransactionImportPreview` response contract.

## Goals / Non-Goals

**Goals:**

- Give Android users a native in-app receipt recognition flow.
- Keep the backend parse endpoint, preview contract, and review/save screen
  shared with the web flow.
- Handle gallery selection, camera capture, cancellation, denied permissions,
  upload errors, and server parse errors without leaving the app.
- Preserve the current browser upload bridge as a fallback for platforms where
  native image picking is unavailable.

**Non-Goals:**

- No on-device QR/OCR implementation.
- No new backend endpoint or changed saved transaction payload.
- No automatic transaction save after recognition.
- No redesign of the mobile review screen beyond displaying the received draft.

## Decisions

1. Use Expo ImagePicker for native Android gallery/camera input.

   Rationale: the project is Expo-based and does not currently include a native
   file picker. `expo-image-picker` provides both gallery and camera flows with
   permission APIs and returns a local asset URI that can be appended to
   `FormData`.

   Alternative considered: keep the WebBrowser upload bridge. It keeps
   dependencies smaller, but fails the native parity goal and is the current
   source of Android friction.

2. Keep receipt parsing server-side.

   Rationale: web and mobile must produce the same receipt behavior. Duplicating
   QR/OCR locally in Android would create inconsistent parsing, larger builds,
   and native dependency complexity.

3. Convert the backend response into `TransactionImportPreview` in the mobile
   service.

   Rationale: `DataImportReviewScreen` already saves drafts from
   `TransactionImportPreview`. The service can accept either the direct parser
   shape or a wrapped `{ preview }` shape so mobile stays tolerant of current
   and existing bridge responses.

4. Allow the camera permission in Android app config while keeping broad media
   permissions blocked.

   Rationale: the current app config blocks `android.permission.CAMERA` and
   the native camera flow cannot work in a built Android app while that
   permission is blocked. Gallery selection can use the Android system picker
   without broad media-library access, so `READ_MEDIA_*` permissions remain
   blocked.

5. Keep the browser bridge as a fallback path.

   Rationale: Expo web and any unsupported native platform still need a working
   path. Android uses native input by default.

## Risks / Trade-offs

- Android local URI multipart differences -> Build `FormData` with explicit
  `uri`, `name`, and `type`, and cover request construction in service tests.
- Permission denial can look like a generic failure -> Return explicit
  user-facing messages for gallery and camera permission denial.
- Expo dependency version mismatch -> Install the SDK-compatible
  `expo-image-picker` package and verify mobile typecheck.
- Android permission policy risk -> Request camera permission only for camera
  capture and keep broad media permissions blocked for gallery selection.
- Mobile unit test harness is minimal -> Add focused Node tests for pure service
  behavior and use `mobile run typecheck` for React Native integration.
