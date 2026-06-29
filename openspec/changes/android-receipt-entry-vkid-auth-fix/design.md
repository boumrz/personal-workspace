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

Android browser PKCE uses `expo-web-browser` Custom Tabs. If the deep-link
callback is not delivered to JS or the provider leaves a Custom Tab on the
custom scheme URL, the auth promise can time out while Expo still considers the
session open. The mobile service must reset that session on browser timeout or
browser open failure and classify `authorization is already in progress` /
`WebBrowser is already open` as stale recoverable state, so the next user tap
starts from a clean auth session instead of surfacing a dead-end modal.

### User Feedback

The login button must never spin forever. VK ID auth already has JS timeouts;
the fallback path must either resolve to a backend token request or reject with
an actionable message.

## Non-Goals

- No backend auth API payload changes.
- No change to web VK ID flow.
- No on-device receipt recognition.

## Virtual Multi-Agent Handoff

- `specification-agent`: add a measurable Android scenario for stale VK ID auth
  sessions and keep web out of scope.
- `product-owner-agent`: MVP is recovery from the reported Android dead-end
  without changing account/linking semantics.
- `architect-agent`: no backend/shared contract change; fix remains inside
  mobile auth service behavior.
- `team-lead-agent`: implement as tests first, then minimal service changes,
  then mobile service/typecheck verification.
- `prompt-task-auditor-agent`: ready; inputs, acceptance criteria, and
  deterministic verification path are available.
- `security-devops-agent`: no new secrets, scopes, or token persistence changes.
- `mobile-agent` and `autotest-agent`: own implementation and regression tests.
- `reviewer-agent`, `test-reviewer-agent`, `qa-agent`: verify no auth loop,
  no silent fallback on user cancellation, and call out remaining real-device QA.
