## Why

Android users cannot discover receipt scanning from the main operations flow,
even though web exposes receipt import near transaction tools. Android VK ID
login also returns from the provider with an endless loading state and does not
reach backend auth logs, while web VK ID login works.

## What Changes

- Add an Android-visible receipt scanning entry point from the operations flow.
- Keep the existing receipt recognition backend and review/save contract.
- Make Android VK ID auth recover when the native SDK callback does not produce
  an access token, by falling back to the browser PKCE flow instead of leaving
  the user in a spinner.
- Add focused mobile service tests for VK ID fallback behavior.
- Keep changes scoped to mobile UI/auth unless inspection proves a backend
  contract change is required.

## Impact

- `mobile/src/navigation/OperationsStack.tsx`
- `mobile/src/navigation/RootNavigator.tsx`
- `mobile/src/screens/TransactionsScreen.tsx`
- `mobile/src/screens/DataToolsScreen.tsx`
- `mobile/src/services/vkIdAuth.ts`
- `mobile/src/services/*.test.ts`
- Android manual QA on a real device remains required for VK provider callback.
