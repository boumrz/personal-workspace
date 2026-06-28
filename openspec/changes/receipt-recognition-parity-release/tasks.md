## 1. Specification And Audit

- [x] 1.1 Add a durable docs/specs implementation inventory for receipt QR/OCR and Android parity.
- [x] 1.2 Record backend/web/mobile/test evidence in the OpenSpec capability delta.
- [x] 1.3 Complete multi-agent audit and list residual gaps.

## 2. Release Version

- [x] 2.1 Bump Android version and versionCode for the next RuStore upload if still on the previous release line.
- [x] 2.2 Keep package lock metadata in sync with the mobile package version.
- [x] 2.3 Sync local native Gradle version metadata used by `expo run:android`.

## 3. Android Parity

- [x] 3.1 Keep the selected Android receipt image available after parse errors.
- [x] 3.2 Add Android retry without reopening gallery/camera.
- [x] 3.3 Normalize Android receipt network failures into a readable connection error.

## 4. Verification

- [x] 4.1 Run backend receipt tests or document local runtime blockers.
  - `npm --prefix server test` was run. QR fixture tests passed, but the OCR photo fixture failed locally because the Windows host does not have `tesseract.exe`; Python OCR packages were installed, and the `winget` Tesseract install was cancelled outside the process.
- [x] 4.2 Run web typecheck/build.
  - `npm run typecheck` and `npm run build` passed. Rspack kept the existing large bundle size warnings.
- [x] 4.3 Run mobile service tests/typecheck.
  - `npm --prefix mobile run test:services` passed 8/8 and `npm --prefix mobile run typecheck` passed.
- [x] 4.4 Start local backend/web/Expo surfaces for Android phone testing, or document the exact blocker.
  - Backend: `http://192.168.1.122:3001/api/health`.
  - Web: `https://192.168.1.122:5174/` with same-origin `/api` proxy.
  - Expo dev-client: `http://192.168.1.122:8081/status` returns `packager-status:running`.
- [x] 4.5 Attempt OpenSpec validation or document local tooling blocker.
  - `openspec validate receipt-recognition-parity-release --strict` could not run because `openspec` is not installed in PATH and the project does not pin an OpenSpec CLI package.
