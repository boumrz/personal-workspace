# Docker Deployment For domiknote.ru

This document describes the Docker cutover for Finance Assistant on
`https://domiknote.ru/` when the same server also hosts
`https://interview.domiknote.ru/`.

## Current Failure Mode

External checks on 2026-06-28 showed:

- `https://domiknote.ru/` fails TLS verification with a wrong certificate name.
- With certificate checks disabled, `https://domiknote.ru/` serves the
  `interview-online` frontend.
- `https://domiknote.ru/api/health` returns `404`.
- `https://interview.domiknote.ru/` returns `200 OK`.

This indicates that `domiknote.ru` is currently routed to the interview vhost or
default TLS server.

## Target Layout

```text
shared reverse proxy (:80/:443)
  domiknote.ru -> finance-assistant web container
  interview.domiknote.ru -> interview stack

finance-assistant stack
  web -> api -> postgres
       -> optional g4f
```

Only the `web` service joins the external reverse-proxy network. API, database,
and sidecars stay on the private compose network.

## Files

- `compose.domiknote.yml`
- `deployment/docker/Dockerfile.api`
- `deployment/docker/Dockerfile.web`
- `deployment/nginx/app.conf`
- `deployment/nginx/reverse-proxy.domiknote.conf`
- `deployment/env/domiknote.env.example`

## Server Setup

Create the shared proxy network once:

```bash
docker network create domiknote_proxy
```

Create production env:

```bash
cp deployment/env/domiknote.env.example deployment/env/domiknote.env
chmod 600 deployment/env/domiknote.env
```

Edit `deployment/env/domiknote.env` and set real secrets:

- `JWT_SECRET`
- `DB_PASSWORD`
- auth provider secrets
- LLM provider secrets, if enabled

Production must not use weak defaults. The API intentionally exits when
`NODE_ENV=production` and weak `JWT_SECRET`, weak `DB_PASSWORD`, or wildcard
`CORS_ORIGIN=*` are used.

## Build And Start

```bash
DOMIKNOTE_ENV_FILE=deployment/env/domiknote.env \
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml build
```

Start database first:

```bash
DOMIKNOTE_ENV_FILE=deployment/env/domiknote.env \
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml up -d postgres
```

Run migrations:

```bash
DOMIKNOTE_ENV_FILE=deployment/env/domiknote.env \
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml --profile migrate run --rm migrate
```

Start app:

```bash
DOMIKNOTE_ENV_FILE=deployment/env/domiknote.env \
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml up -d api web
```

If the g4f sidecar is needed:

```bash
DOMIKNOTE_ENV_FILE=deployment/env/domiknote.env \
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml --profile g4f up -d g4f
```

## Shared Reverse Proxy

Install/adapt `deployment/nginx/reverse-proxy.domiknote.conf` in the shared
reverse proxy that terminates TLS.

The proxy must have separate vhosts:

- `server_name domiknote.ru`
- `server_name interview.domiknote.ru`

The `domiknote.ru` vhost must use a certificate whose SAN includes
`domiknote.ru`.

Example certificate command:

```bash
certbot --nginx -d domiknote.ru
```

If the shared proxy is containerized, it must join the same external Docker
network as Finance Assistant:

```bash
docker network connect domiknote_proxy <reverse-proxy-container>
```

## Legacy PM2 Workflow

`.github/workflows/deploy.yml` no longer runs legacy frontend/backend PM2 deploy
jobs on every push. Those jobs run only from `workflow_dispatch` when
`deploy_legacy_host=true`.

Before production cutover, make sure no external automation still deploys the
old `/var/www/finance-assistant/dist` plus PM2 layout onto `domiknote.ru`.

## Verification

Local container checks on the server:

```bash
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml ps
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml logs --tail=100 api
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml exec web wget -qO- http://127.0.0.1/api/health
```

External checks:

```bash
curl -Iv https://domiknote.ru/
curl -fsS https://domiknote.ru/api/health
curl -Iv https://interview.domiknote.ru/
```

Expected:

- `domiknote.ru` certificate verifies successfully.
- `domiknote.ru` serves Finance Assistant HTML, not `interview-online`.
- `domiknote.ru/api/health` returns `{"status":"ok"}`.
- `interview.domiknote.ru` still serves the interview app.

## Rollback

If cutover fails:

1. Restore the previous shared reverse-proxy config for `domiknote.ru`.
2. Reload the shared proxy.
3. Keep Docker containers running for debugging or stop them:

```bash
docker compose --env-file deployment/env/domiknote.env -f compose.domiknote.yml down
```

Do not point `domiknote.ru` to the interview vhost as a rollback. That recreates
the current failure mode.
