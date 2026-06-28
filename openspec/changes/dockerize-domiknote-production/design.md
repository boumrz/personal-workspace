## Context

External verification on 2026-06-28 showed:

- `curl https://domiknote.ru/` fails certificate verification with
  `SEC_E_WRONG_PRINCIPAL`.
- `curl -k https://domiknote.ru/` returns the `interview-online` HTML.
- `curl -k https://domiknote.ru/api/health` returns `404` from the currently
  active Nginx/proxy chain.
- `https://interview.domiknote.ru/` returns `200 OK`.

This means `domiknote.ru` is currently routed through the interview vhost/stack
or served with the interview certificate/default server.

## Architecture

```text
Internet
  -> host/shared reverse proxy on :80/:443
       - server_name domiknote.ru
         -> finance-web:80
       - server_name interview.domiknote.ru
         -> interview-web:80

finance stack
  finance-web (Nginx)
    - serves built React SPA
    - proxies /api to finance-api:3001
  finance-api (Node/Express)
    - connects to finance-postgres:5432
    - optionally connects to finance-g4f:1337
    - includes Python/OpenCV/Tesseract runtime for receipt QR/OCR
  finance-postgres
  finance-g4f (optional)
```

## Docker Network Model

- `finance_internal`: private compose network for API, DB, and optional g4f.
- `domiknote_proxy`: external Docker network shared only with the host reverse
  proxy and the web containers that need ingress.
- Only `finance-web` joins `domiknote_proxy`.
- `finance-api`, `finance-postgres`, and `finance-g4f` are not exposed to the
  public reverse proxy network unless a future change explicitly requires it.

## TLS/VHost Model

- TLS certificates stay at the shared host reverse proxy.
- The finance stack does not terminate TLS.
- The shared proxy must have separate `server_name` blocks for:
  - `domiknote.ru`
  - `interview.domiknote.ru`
- The `domiknote.ru` certificate must include `domiknote.ru` in SAN.
- The default TLS server must not serve the interview certificate for
  `domiknote.ru`.

## App Nginx

The finance web container Nginx:

- Serves `/usr/share/nginx/html`.
- Uses SPA fallback to `/index.html`.
- Keeps `vk-id-callback.html` as a real static file.
- Proxies `/api/` to `http://api:3001/api/`.
- Sets `client_max_body_size 10m` for receipt uploads.
- Preserves `Host`, `X-Real-IP`, `X-Forwarded-*` headers.

## API Image

The API image must include:

- Node.js production dependencies from `server/package-lock.json`.
- Python 3 runtime.
- `server/requirements.txt` Python packages.
- System Tesseract packages required by receipt OCR.
- App source needed by `server/src/server.js`.

Production environment must set:

- `NODE_ENV=production`
- `PORT=3001`
- `DB_HOST=postgres`
- `DB_NAME=finance_assistant`
- `DB_USER=finance_assistant`
- strong `DB_PASSWORD`
- strong `JWT_SECRET`
- `CORS_ORIGIN=https://domiknote.ru`
- `GPT4FREE_BASE_URL=http://g4f:1337/v1` if g4f is enabled
- `RECEIPT_QR_PYTHON=python3`

## Migration Policy

Migrations run as an explicit one-shot compose profile/service before starting
or updating the API:

```bash
docker compose -f compose.domiknote.yml --env-file deployment/env/domiknote.env run --rm migrate
```

This avoids hidden schema changes during container boot and makes rollback
clearer.

## Cutover Plan

1. Build images on the server.
2. Create/populate `.env` from `deployment/env/domiknote.env.example`.
3. Create the external proxy network if missing.
4. Start `postgres`, optional `g4f`, run `migrate`, then start `api` and `web`.
5. Add/update shared reverse proxy vhost:
   - `domiknote.ru -> finance-web:80`
   - `interview.domiknote.ru -> interview stack`
6. Issue or reinstall a certificate whose SAN includes `domiknote.ru`.
7. Reload the shared reverse proxy.
8. Verify:
   - certificate subject/SAN for `domiknote.ru`
   - `GET https://domiknote.ru/` returns Finance Assistant HTML
   - `GET https://domiknote.ru/api/health` returns `{"status":"ok"}`
   - `GET https://interview.domiknote.ru/` still returns interview app

## Rollback Plan

- Keep the old PM2/host deployment stopped but not deleted until verification
  passes.
- If cutover fails, point the shared proxy `domiknote.ru` vhost back to the old
  upstream or restore the previous Nginx config and reload proxy.
- Do not reuse the interview vhost or certificate for finance rollback.

## Risks

- Existing GitHub deploy workflow can redeploy legacy PM2 files and conflict
  with Docker. The workflow should be disabled or made manual-only before
  production cutover.
- If receipt OCR system packages are missing in the API image, receipt parsing
  will fail at runtime. Include runtime dependencies in the Dockerfile.
- If `CORS_ORIGIN` remains wildcard in production, the backend will fail closed
  by design.
- If the shared reverse proxy has a broad default server for the interview app,
  `domiknote.ru` can continue serving the wrong app even when the finance stack
  is healthy.
