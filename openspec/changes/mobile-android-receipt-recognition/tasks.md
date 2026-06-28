## 1. Native Receipt Upload Service

- [x] 1.1 Add failing service tests for Android gallery/camera receipt upload, cancellation, permission denial, and server error mapping.
- [x] 1.2 Add the Expo image picker dependency and Android app config permissions required for native photo and camera input.
- [x] 1.3 Implement native Android receipt image selection/capture and multipart upload to the shared receipt parse endpoint.
- [x] 1.4 Preserve web DOM upload and unsupported-native browser bridge fallback behavior.

## 2. Mobile Screen Integration

- [x] 2.1 Wire `DataToolsScreen` to the native receipt service result and keep the existing `DataImportReview` navigation.
- [x] 2.2 Update Android user-facing copy so the screen no longer says the primary flow opens a browser.

## 3. Verification

- [x] 3.1 Run focused mobile service tests and verify the new behavior.
- [x] 3.2 Run `npm --prefix mobile run typecheck`.
- [x] 3.3 Run OpenSpec validation for `mobile-android-receipt-recognition`.
