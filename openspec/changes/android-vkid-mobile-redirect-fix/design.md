## Current Flow

`LoginScreen` and `ProfileScreen` pass `NativeModules.VkIdModule.login` into
`getVkIdAccessToken`. The core service first tries the native VK SDK and falls
back to browser PKCE for recoverable native errors. The browser path builds a
VK mobile redirect URI with `buildVkMobileRedirectUri(appId)`.

## Problem

On real Android devices the native SDK can fail before opening/returning control
properly, leaving the user with a generic `Не удалось открыть VK ID` message.
The user-facing requirement is to return from VK's permission modal through the
mobile VK scheme:

```text
vk54468830://vk.ru/blank.html
```

## Decision

Android login/linking should call the browser PKCE flow directly by default.
That path uses the VK mobile redirect URI for both the authorization URL and
the code-to-token exchange.

The native module remains in the codebase, but call sites stop passing it into
the default login/link flows. This avoids native SDK startup/configuration
issues while preserving a future controlled native path.

## Risks

- VK ID application settings must include the mobile redirect URI exactly.
- The APK must include an intent filter for scheme `vk<client_id>`, host
  `vk.ru`, path `/blank.html`.
- A new Android build is required because intent filters and native code are
  packaged into the APK/AAB.
