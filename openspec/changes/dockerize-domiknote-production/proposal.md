## Why

`https://domiknote.ru/` and `https://interview.domiknote.ru/` are hosted on the
same server. After the interview service was moved to Docker and its certificate
was regenerated, `https://domiknote.ru/` started serving the interview frontend
and TLS verification for `domiknote.ru` fails with a wrong certificate name.

Finance Assistant must be isolated into its own Docker stack so the two products
do not share app processes, upstream ports, or vhost routing by accident.

## What Changes

- Add Docker production packaging for Finance Assistant web and API.
- Add an app-local Nginx container config that serves the SPA and proxies `/api`
  to the API container.
- Add a `compose.domiknote.yml` stack with isolated internal services and an
  optional external reverse-proxy network.
- Add production environment examples for Docker deployment.
- Add Docker deployment/cutover documentation for `domiknote.ru`.
- Update SDD/OpenSpec and multi-agent rules so future changes use this process.

## Capabilities

### New Capabilities

- `domiknote-docker-production`: Finance Assistant can run as an isolated Docker
  stack behind a shared host reverse proxy.

### Modified Capabilities

- Development workflow: all project changes must go through SDD/OpenSpec and
  the configured multi-agent process.

## Impact

- Deployment artifacts are added without removing the existing PM2/host deploy
  path.
- Production server cutover still requires operator actions on the server:
  DNS/TLS/vhost changes, Docker network creation, secrets provisioning, and old
  PM2/nginx route shutdown.
- The shared reverse proxy must route `domiknote.ru` to the Finance Assistant
  web container and `interview.domiknote.ru` to the interview stack.
