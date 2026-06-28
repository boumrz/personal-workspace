## Why

Receipt recognition is now implemented through a QR-first, OCR-fallback path.
Future agents need a precise implementation inventory so they do not invent
missing capabilities, assume LLM parsing, or treat web and Android flows as
separate products.

The Android release version must also move forward after receipt and deployment
changes so a new build can be uploaded to RuStore.

## What Changes

- Add a durable receipt recognition implementation/parity spec in `docs/specs/`.
- Add an OpenSpec capability delta that names the backend, web, mobile, test,
  and release-version contracts.
- Audit the current backend and Android implementation against the specs.
- Bump the Android app version/versionCode when the current values still match
  the previous release line.
- Run focused checks and start local web/mobile development surfaces for phone
  testing where the local environment allows it.

## Impact

- `docs/specs/`: implementation inventory and parity contract.
- `openspec/changes/receipt-recognition-parity-release/`: SDD artifacts.
- `mobile/package.json`, `mobile/package-lock.json`, `mobile/app.json`:
  Android release version bump.
- Verification may include backend receipt tests, web build/typecheck, mobile
  service tests/typecheck, and Expo local start.
