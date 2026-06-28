## Current Findings

Receipt scanning exists on Android in `DataToolsScreen`, but the screen is only
registered in `ProfileStack`. A user working in the main operations tab sees
only the add-operation FAB and has no visible receipt scan affordance.

VK ID web login uses the web SDK and works. Android login first calls the native
`VkIdModule.login()`. The JS service only falls back to the browser PKCE flow
for certificate pinning failures. If the native flow returns only auth code,
times out, or otherwise fails before backend exchange, the backend receives no
request and the user can remain in a loading state.

## Design

### Receipt Entry

Register `DataToolsScreen` and `DataImportReviewScreen` in the operations stack.
Add a compact scan button near the operations search/filter controls, using a
receipt/scan icon. Navigating from operations should open the same
`DataToolsScreen` implementation used elsewhere, so gallery/camera upload,
immediate parse, review, and save behavior remain identical.

Deep links and existing profile entry remain compatible. When a receipt draft is
ready, route review through operations where possible because the user is
creating an operation.

### VK ID Recovery

Keep native VK ID as the first attempt, but treat native timeout, code-only
completion, and SDK failures as recoverable provider failures. For those cases,
start the browser PKCE flow with the configured redirect URI. Do not fall back
when the user explicitly cancels.

Expose dependency injection in `vkIdAuth.ts` so unit tests can simulate native
hang/failure and verify browser fallback without launching a real browser.

### User Feedback

The login button must never spin forever. VK ID auth already has JS timeouts;
the fallback path must either resolve to a backend token request or reject with
an actionable message.

## Non-Goals

- No backend auth API payload changes.
- No change to web VK ID flow.
- No on-device receipt recognition.
