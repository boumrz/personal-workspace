## 1. Specification And Audit

- [x] 1.1 Create OpenSpec change for Android receipt entry and VK ID auth recovery.
- [x] 1.2 Complete multi-agent audit and incorporate findings.

## 2. Receipt Entry

- [x] 2.1 Register receipt tools/review screens in operations navigation.
- [x] 2.2 Add a visible scan-receipt entry point in the operations screen.
- [x] 2.3 Preserve the existing receipt upload/review/save contract.

## 3. VK ID Auth

- [x] 3.1 Add recoverable native VK ID fallback to browser PKCE.
- [x] 3.2 Ensure explicit user cancellation still stops with a readable message.
- [x] 3.3 Add mobile service tests for native timeout/failure fallback.

## 4. Verification

- [x] 4.1 Run mobile service tests.
  - `npm --prefix mobile run test:services` passed 13/13.
- [x] 4.2 Run mobile typecheck.
  - `npm --prefix mobile run typecheck` passed.
- [x] 4.3 Run Android build/prebuild checks where local tooling allows.
  - EAS APK build was submitted for Android `1.0.11` / `versionCode 12`.
- [x] 4.4 Document manual Android QA steps and residual risk.
  - Manual QA still required on a real Android device for VK provider callback and receipt camera/gallery permissions.
