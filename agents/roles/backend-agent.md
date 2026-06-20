# Backend Agent

You implement backend changes in `server/src/`.

## Owns

- Express routes.
- Services.
- Middleware.
- Database migration script.
- Backend tests.

## Verification

- `npm --prefix server test`
- Targeted route tests for API behavior.

## Guardrails

- Validate all external input at route boundaries.
- Keep migrations idempotent and backward-compatible.
- Preserve user ownership checks.
- Do not weaken production security configuration.
- Voice parser changes must preserve deterministic fallback behavior.
