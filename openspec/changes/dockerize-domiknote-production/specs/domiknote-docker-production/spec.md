## ADDED Requirements

### Requirement: Finance Assistant runs as an isolated Docker stack
`domiknote.ru` SHALL be deployable as a Docker Compose stack with separate web,
API, database, and optional LLM sidecar services.

#### Scenario: Only web is exposed to the shared reverse proxy
- **WHEN** the Docker stack is started
- **THEN** only the web container joins the external reverse-proxy network
- **AND** API, database, and optional sidecar services remain on an internal
  finance-only network

#### Scenario: API uses Docker service names
- **WHEN** the API container runs in production
- **THEN** it connects to PostgreSQL via `DB_HOST=postgres`
- **AND** it connects to optional g4f via `GPT4FREE_BASE_URL=http://g4f:1337/v1`

### Requirement: App Nginx serves SPA and proxies API
The finance web container SHALL serve the built React SPA and proxy API requests
to the finance API container.

#### Scenario: SPA route fallback works
- **WHEN** a browser requests a client route such as `/finance/transactions`
- **THEN** the web container returns `index.html`

#### Scenario: API health is proxied
- **WHEN** a client requests `/api/health`
- **THEN** the web container proxies the request to `api:3001`
- **AND** the response body is `{"status":"ok"}`

#### Scenario: Receipt uploads are accepted
- **WHEN** a client uploads a receipt image up to the backend limit
- **THEN** Nginx does not reject the request with the default 1 MB limit

### Requirement: Shared reverse proxy separates domains
The production server SHALL route `domiknote.ru` and `interview.domiknote.ru`
through separate vhost entries and upstream containers.

#### Scenario: domiknote uses its own certificate and upstream
- **WHEN** a client opens `https://domiknote.ru/`
- **THEN** TLS verification succeeds for `domiknote.ru`
- **AND** the response is the Finance Assistant frontend

#### Scenario: interview stays isolated
- **WHEN** a client opens `https://interview.domiknote.ru/`
- **THEN** TLS verification succeeds for `interview.domiknote.ru`
- **AND** the response is the interview application

### Requirement: Production deployment fails closed for unsafe secrets
The Docker production environment SHALL keep existing production safety checks.

#### Scenario: weak secrets are used
- **WHEN** `NODE_ENV=production` and `JWT_SECRET` or `DB_PASSWORD` are weak defaults
- **THEN** the API exits instead of serving traffic

#### Scenario: wildcard CORS is used in production
- **WHEN** `NODE_ENV=production` and `CORS_ORIGIN=*`
- **THEN** the API exits instead of serving traffic
