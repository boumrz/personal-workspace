## 1. SDD And Multi-Agent Rules

- [x] 1.1 Add a project skill for SDD/OpenSpec plus multi-agent workflow.
- [x] 1.2 Update Codex and Cursor rules so OpenSpec is required before project changes.
- [x] 1.3 Register OpenSpec skills in the project skill catalog.

## 2. Docker Production Packaging

- [x] 2.1 Add Docker ignore rules for lean image contexts.
- [x] 2.2 Add API Dockerfile with Node, Python, OpenCV, and Tesseract runtime.
- [x] 2.3 Add web Dockerfile that builds the React app and serves it through Nginx.
- [x] 2.4 Add app Nginx config for SPA, `/api`, upload size, and forwarding headers.
- [x] 2.5 Add `compose.domiknote.yml` with isolated finance services and networks.
- [x] 2.6 Add Docker production env example.

## 3. Deployment Documentation And Safety

- [x] 3.1 Document shared reverse proxy vhost/certificate cutover for `domiknote.ru`.
- [x] 3.2 Document migration, health-check, verification, and rollback commands.
- [x] 3.3 Document how to prevent the legacy PM2 deploy workflow from conflicting.

## 4. Verification

- [x] 4.1 Validate Docker-related files for syntax where possible.
  - `docker compose --env-file deployment/env/domiknote.env.example -f compose.domiknote.yml config` passed.
  - `docker run nginx -t` could not run because Docker Desktop engine is not running locally.
- [ ] 4.2 Run typecheck/server tests if code behavior changes.
  - `npm run typecheck` passed.
  - `npm run build` passed with existing bundle-size warnings.
  - `npm --prefix server test` failed on existing receipt fixture
    `receipt-photo-polza-300.png` returning 422 instead of 200.
- [x] 4.3 Record external TLS/routing findings and residual production actions.
