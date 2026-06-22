# Technical Specification: Finance Assistant

Document version: 1.0  
Last updated: 2026-06-19

## 0. Purpose

This specification is the source of truth for future development of
`finance-assistant`. It describes what the product currently does, which
contracts must stay stable, and where the next work should be routed in the
multi-agent development system.

Related artifacts:

- Multi-agent workflow: `MULTI_AGENT_SYSTEM.md`
- Agent contracts: `agents/`
- Codex rules: `AGENTS.md`
- Cursor rules: `.cursor/rules/00-multi-agent-system.mdc`

## 1. Product Goal

Finance Assistant helps a user track personal finances across web and mobile:

- actual income and expense transactions;
- planned expenses;
- savings entries;
- financial goals;
- categories with colors and icons;
- dashboard visualizations;
- profile and authentication methods;
- voice-assisted transaction parsing;
- data import/export and receipt preview flows.

The product should optimize for fast personal entry, safe financial data
handling, predictable mobile/web parity, and recoverable auth/session behavior.

## 2. User Roles

### Anonymous user

- Can access public auth screens only.
- Cannot read or mutate finance data.

### Authenticated user

- Owns categories, transactions, planned expenses, savings, goals, and profile.
- Can use login/password, Telegram, VK ID, and refresh-token session flow.
- Can configure or inherit voice parser LLM provider preferences.

### Admin user

- Can list, update, and delete users.
- Can configure per-user LLM provider chain and enabled provider set.
- Must be protected by backend authorization, not only frontend routing.

## 3. Implemented Scope

### Web application

- React SPA under `src/`.
- Protected finance routes:
  - `/finance/dashboard`
  - `/finance/transactions`
  - `/finance/savings`
  - `/profile`
  - `/admin`
- Authenticated data loading through RTK Query in `src/store/api.ts`.
- Ant Design theming with light/dark tokens.
- CSS Modules for component styling.
- Voice assistant UI for transaction parsing.
- Data tools UI for import/export/receipt preview.

### Backend API

Express app under `server/src/` with:

- `helmet`, `cors`, `compression`, `express-rate-limit`;
- JWT access and refresh token flow;
- PostgreSQL pool and idempotent migration script;
- authenticated finance CRUD routes;
- admin routes;
- analytics event ingestion;
- versioned transaction data tools under `/api/v2/transactions`.

### Mobile application

- Expo/React Native app under `mobile/`.
- Uses `@finance-assistant/shared` for types and API client.
- Android-first assumptions for local dev API URL.
- VK ID mobile auth uses the Android native module when available and falls
  back to Expo browser PKCE exchange when native token exchange fails or the
  native module is unavailable.
- Navigation stacks for dashboard, operations, savings, and profile.
- Voice/data-tool flows share backend contracts with web.

### Shared package

- `shared/src/types` defines cross-layer TypeScript shapes.
- `shared/src/api` provides a fetch-based API client for mobile.
- Any API payload change must be reflected here before mobile work is considered complete.

## 4. Architecture

### Frontend stack

- React 18
- TypeScript
- Redux Toolkit and RTK Query
- Ant Design
- Chart.js / react-chartjs-2
- React Router
- CSS Modules
- Rspack
- Playwright for e2e

### Backend stack

- Node.js ESM
- Express
- PostgreSQL via `pg`
- JWT via `jsonwebtoken`
- Password hashing via `bcrypt`
- Security middleware: Helmet, CORS, rate limits
- Node test runner and Supertest

### Mobile stack

- Expo
- React Native
- React Navigation
- AsyncStorage
- Shared package file dependency
- MyTracker analytics integration

### Deployment

- Web builds to `dist/`.
- Backend runs from `server/src/server.js`.
- Nginx config and deployment docs exist in repository.
- Production must set strong `JWT_SECRET` and explicit `CORS_ORIGIN`.

## 5. Data Model

The migration script is idempotent and creates or updates these core tables:

- `users`
  - login/email/password/social identifiers;
  - profile fields;
  - Telegram and VK IDs;
  - login analytics fields;
  - voice LLM provider settings.
- `categories`
  - user-owned category name, color, icon.
- `transactions`
  - actual income/expense rows.
- `planned_expenses`
  - planned expense rows.
- `savings`
  - savings records.
- `goals`
  - title, target amount, current amount, description.
- `analytics_events`
  - event name, platform, user, JSON payload.

All finance domain rows are user-scoped. New tables must preserve this ownership
model unless the specification explicitly introduces shared objects.

## 6. API Contracts

Base API prefix: `/api`.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/telegram/bot-id`
- `POST /auth/telegram`
- `POST /auth/vkid`
- `GET /auth/google`
- `GET /auth/google/callback`

### Finance data

- `GET/POST /categories`
- `GET/DELETE /categories/:id`
- `GET/POST /transactions`
- `GET/PUT/DELETE /transactions/:id`
- `GET/POST /planned-expenses`
- `GET/PUT/DELETE /planned-expenses/:id`
- `GET/POST /savings`
- `GET/PUT/DELETE /savings/:id`
- `GET/POST /goals`
- `GET/PUT/DELETE /goals/:id`

### Profile

- `GET/PUT /profile`
- `POST /profile/link/telegram`
- `POST /profile/unlink/telegram`
- `POST /profile/link/vkid`
- `POST /profile/unlink/vk`
- `POST /profile/set-password`

### Admin

- `GET /admin/users`
- `PUT /admin/users/:id`
- `DELETE /admin/users/:id`
- `GET /admin/llm-providers`
- `PUT /admin/users/:id/llm`

### Analytics

- `POST /analytics/event`

### Transaction data tools

- `GET /v2/transactions/llm-options`
- `GET|POST /v2/transactions/export`
- `POST /v2/transactions/import`
- `POST /v2/transactions/receipt/parse`
- `POST /v2/transactions/parse`

## 7. Voice and LLM Parsing

The voice parser accepts short transaction phrases and returns normalized draft
items. It must remain safe under unreliable or unavailable external LLMs.

Supported provider IDs:

- `gigachat`
- `gpt4free`
- `gemini`
- `gemini-flash-lite`
- `openrouter`
- `groq`
- `heuristic`

Rules:

- Validate request keys, text length, locale/timezone, provider IDs, and prompt injection patterns.
- Enforce max parsed items and max provider-chain length.
- Always include `heuristic` fallback unless explicitly already present.
- Sanitize warnings and category hints before returning them to clients.
- User-level provider settings may override global provider settings.
- If a phrase contains an operation date, parse it to `YYYY-MM-DD`; use today's date
  only when no date was said or detected.
- Mobile voice drafts must edit dates through the platform date picker, not free
  text input.

## 8. Security Requirements

- All finance and profile routes require authenticated user context.
- Admin routes require backend admin authorization.
- Production startup must reject placeholder `JWT_SECRET`.
- Production startup must reject wildcard `CORS_ORIGIN`.
- Rate limiting stays enabled by default.
- Imported files and receipt images must enforce size and type constraints.
- Never expose raw provider secrets, JWT secrets, or user password hashes.

## 9. UX Requirements

- Web and mobile must keep feature parity for core finance operations.
- Every mutating flow needs clear success and error handling.
- Voice and import flows must show partial success, warnings, and recoverable validation failures.
- Forms must protect against accidental invalid amounts and missing categories.
- Mobile flows must handle denied microphone/file permissions explicitly.
- Admin screens must distinguish global defaults from user overrides.

## 10. Quality Gates

Use these commands as the default verification matrix:

```bash
npm run check:secrets
npm run typecheck
npm --prefix shared run build
npm --prefix server test
npm --prefix mobile run typecheck
npm run build
```

Run `npm run test:e2e` when web navigation, auth, voice assistant, or data tools
change. Run targeted server tests when parser, auth, security, or migration logic
changes.

## 11. Development Guardrails

- Specification changes precede implementation for new features.
- API changes update backend, `shared`, web RTK Query types, mobile client, tests, and this spec.
- Migrations must be idempotent and backward-compatible.
- User-owned data must remain scoped by `user_id`.
- Do not weaken security defaults to simplify local development.
- Do not introduce new LLM providers without fallback and timeout behavior.

## 12. Known Risks and Technical Debt

- Migration logic is large and script-based; schema changes need extra review.
- Web and shared types partially duplicate shapes; contract drift is possible.
- Mobile uses file-based shared package dependency and must be typechecked after shared changes.
- Auth supports several identity providers; account linking and unlinking require careful regression tests.
- Voice parsing depends on external providers and should never block deterministic fallback.
- Existing repository has historical encoding artifacts in some Russian text outputs; avoid broad rewrites.

## 13. Initial Backlog

1. Normalize shared API contracts across web and mobile.
2. Split migration script into smaller documented schema sections or migration files.
3. Add regression tests for auth refresh behavior on web and mobile clients.
4. Expand data import/export e2e coverage.
5. Add admin LLM provider UI smoke tests.
6. Add structured spec pages for finance operations, voice parsing, and mobile parity.
7. Document production observability and retention policy for analytics events.
