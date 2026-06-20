# Backend-Only Deployment Compatibility & Rollback

Goal: deploy server independently from web/android releases without breaking existing clients.

## Compatibility Contract

Existing clients depend on:

- Stable base path: `/api`
- Auth flows: `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`
- Finance resources: `/api/categories`, `/api/transactions`, `/api/planned-expenses`, `/api/savings`
- Voice parse endpoint: `/api/v2/transactions/parse`

Rules:

- Keep response field names backward-compatible.
- Additive changes only (new optional fields are allowed).
- Do not remove/rename existing required fields without a major client rollout.

## Release Flow (Server-Only)

1. Run quality gates (`typecheck`, server tests, e2e, secret check).
2. Deploy backend using `.github/workflows/deploy.yml` (`deploy-backend` job).
3. Do not rebuild/redeploy frontend in same change unless explicitly needed.
4. Run post-deploy smoke checks:
   - `GET /api/health`
   - auth refresh flow
   - list categories/transactions
   - `POST /api/v2/transactions/parse` with valid payload
5. Monitor error rate and latency for at least one observation window.

## Safe Rollback

Trigger rollback when any of these happen:

- 5xx error rate above normal baseline
- Auth refresh/login regression
- Parse endpoint returns non-contract payload for production traffic

Rollback steps:

1. Re-deploy last known good server commit (`DEPLOY_REF` in deploy workflow).
2. Keep current frontend/mobile clients unchanged.
3. Re-run smoke checks.
4. Create follow-up issue with root cause and prevention action.

## Environment & Feature Flags

- Keep critical config in environment variables only.
- Use provider chain controls (`LLM_PROVIDER_CHAIN`, `LLM_ENABLED_PROVIDERS`) as feature flags.
- Keep `heuristic` fallback in parser chain to reduce runtime outage risk when external providers fail.
