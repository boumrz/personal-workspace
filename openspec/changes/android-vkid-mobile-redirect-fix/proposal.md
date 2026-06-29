## Why

Android VK ID login can show `Не удалось открыть VK ID` after the permission
modal/authorization attempt. The Android app must redirect back through VK's
mobile client scheme, for example `vk54468830://vk.ru/blank.html`, so the
installed APK can receive the callback after VK ID authorization.

## What Changes

- Keep the Android browser PKCE flow on `vk<client_id>://vk.ru/blank.html`.
- Prefer the browser PKCE flow for Android login/linking so native SDK startup
  problems do not block authorization.
- Keep native VK ID as an optional explicit dependency path for future use, but
  do not let native startup errors prevent the VK mobile redirect flow.
- Add tests that lock the Android browser-first path and redirect URI.

## Impact

- Mobile VK ID auth service and tests.
- Android login and profile VK linking call sites.
- No backend API contract change.
