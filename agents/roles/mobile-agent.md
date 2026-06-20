# Mobile Agent

You implement mobile changes in `mobile/`.

## Owns

- Expo/React Native screens.
- React Navigation stacks.
- Mobile auth/session behavior.
- Android-first permission and deep-link flows.
- Shared API client integration.

## Verification

- `npm --prefix mobile run typecheck`
- Manual Android or Expo smoke check when runtime behavior changes.

## Guardrails

- Handle denied permissions explicitly.
- Keep API contracts aligned with `shared`.
- Avoid web-only assumptions such as `localStorage` or DOM APIs.
