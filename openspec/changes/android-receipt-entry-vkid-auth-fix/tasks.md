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
- [x] 3.4 Reset stale Android browser VK ID sessions and cover the reported
  "authorization is already in progress" retry path.
- [x] 3.5 Use the VK mobile redirect URI for Android browser PKCE callback.

## 4. Verification

- [x] 4.1 Run mobile service tests.
  - `npm --prefix mobile run test:services` passed 13/13.
- [x] 4.2 Run mobile typecheck.
  - `npm --prefix mobile run typecheck` passed.
- [x] 4.5 Re-run mobile service tests for stale VK ID auth sessions.
  - `npm --prefix mobile run test:services` passed 17/17.
- [x] 4.6 Re-run mobile typecheck after VK ID auth recovery fix.
  - `npm --prefix mobile run typecheck` passed.
- [x] 4.7 Re-run mobile service tests and typecheck after VK mobile redirect
  URI fix.
  - `npm --prefix mobile run test:services` passed 18/18.
  - `npm --prefix mobile run typecheck` passed.
- [x] 4.8 Rebuild Android APK with production mobile env after VK redirect URI
  fix.
  - `cd mobile/android && NODE_ENV=production EXPO_PUBLIC_API_URL=https://domiknote.ru/api EXPO_PUBLIC_VK_ID_APP_ID=54468830 EXPO_PUBLIC_VK_ID_REDIRECT_SCHEME=financeassistant NPM_CONFIG_LEGACY_PEER_DEPS=true ./gradlew :app:createBundleReleaseJsAndAssets :app:assembleRelease --rerun-tasks` passed.
  - APK is `1.0.11` / `versionCode 12` at
    `mobile/android/app/build/outputs/apk/release/app-release.apk`, SHA-256
    `791405825b2f6c8f9d64a0565756661941b05d83e458b94d37ae765f90751fc6`.
  - Release JS bundle contains `blank.html` and `vk.ru`; the checked grep output
    did not include the old `financeassistant://vkid` browser redirect.
- [x] 4.3 Run Android build/prebuild checks where local tooling allows.
  - EAS APK build was submitted for Android `1.0.11` / `versionCode 12`.
  - `cd mobile/android && ./gradlew assembleRelease` passed; APK is
    `1.0.11` / `versionCode 12` at
    `mobile/android/app/build/outputs/apk/release/app-release.apk`, SHA-256
    `10993c1c6cc76651716a42bae815479876e4e8d6b36ba97bf0daa15fc832afac`.
- [x] 4.4 Document manual Android QA steps and residual risk.
  - Manual QA still required on a real Android device for VK provider callback and receipt camera/gallery permissions.
