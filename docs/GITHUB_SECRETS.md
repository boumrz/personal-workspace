# Secrets Management (GitHub + EAS)

This project must not store production tokens/secrets in source code, committed `.env` files, or `eas.json`.

## 1) Security Rules

- Keep runtime secrets only in:
  - GitHub Actions Secrets (web/server CI/CD)
  - EAS environment/secrets (Android build/runtime env)
- Commit only placeholder examples (`.env.example`, `server/.env.example`, `mobile/.env.example`).
- Inject secrets at build/deploy time.
- Never put real values into PRs, issue comments, or screenshots.

## 2) GitHub Secrets Inventory

Set these in repository settings (`Settings -> Secrets and variables -> Actions`):

### Server deploy

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PATH`
- `SERVER_HEALTHCHECK_URL`
- `SSH_PRIVATE_KEY`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGIN`

### Optional auth/integrations

- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `VK_ID_APP_ID`
- `VK_ID_APP_IDS`
- `VITE_VK_ID_APP_ID`
- `VITE_TELEGRAM_BOT_USERNAME`

### Voice parser providers (optional)

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `LLM_PROVIDER_CHAIN`
- `LLM_ENABLED_PROVIDERS`
- `GIGACHAT_AUTH_KEY` or (`GIGACHAT_CLIENT_ID` + `GIGACHAT_CLIENT_SECRET`)
- `GIGACHAT_SCOPE`
- `GIGACHAT_AUTH_URL`
- `GIGACHAT_BASE_URL`
- `GIGACHAT_CA_CERT_PEM` or `GIGACHAT_CA_CERT_BASE64` or `GIGACHAT_CA_CERT_PATH`
- `GIGACHAT_ALLOW_INSECURE_TLS` (dev-only fallback, keep `false` in production)
- `GPT4FREE_BASE_URL`
- `GPT4FREE_API_KEY`
- `GPT4FREE_MODEL`
- `GPT4FREE_TIMEOUT_MS`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_FLASH_LITE_MODEL`

### Android build

- `EXPO_TOKEN`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_MYTRACKER_SDK_KEY`
- `EXPO_PUBLIC_VK_ID_APP_ID`
- `EXPO_PUBLIC_VK_ID_REDIRECT_SCHEME`
- `EXPO_PUBLIC_SPEECH_PARSE_PROVIDER`
- `EXPO_PUBLIC_VK_ID_CLIENT_SECRET`

## 3) EAS Environments (Android)

Configure runtime/build env in Expo project:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://<api-domain>/api"
eas secret:create --scope project --name EXPO_PUBLIC_MYTRACKER_SDK_KEY --value "<value>"
eas secret:create --scope project --name EXPO_PUBLIC_VK_ID_APP_ID --value "<value>"
eas secret:create --scope project --name EXPO_PUBLIC_VK_ID_REDIRECT_SCHEME --value "financeassistant"
eas secret:create --scope project --name EXPO_PUBLIC_SPEECH_PARSE_PROVIDER --value "heuristic"
eas secret:create --scope project --name EXPO_PUBLIC_VK_ID_CLIENT_SECRET --value "<value>"
```

Use environment-specific values (`development`, `preview`, `production`) through EAS env management.

## 4) Local Development

- Root: copy `.env.example` -> `.env` and keep local values only.
- Mobile: copy `mobile/.env.example` -> `mobile/.env`.
- Do not commit `.env`/`mobile/.env`/`server/.env`.

## 5) CI Protection

- Run `npm run check:secrets` locally before push.
- CI `Quality Gates` runs the same check and fails on suspicious tokens/private keys.
