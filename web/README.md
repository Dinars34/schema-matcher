# Schema Matcher web app

The React/Vite client is typed against the checked-in OpenAPI contract
(`v1.1.0`). It communicates through `web/src/api/`; page components do not
implement matching logic. The FastAPI mock is a deterministic contract
reference, not the production matching engine. The real server has not yet
been verified against this contract; see [the mismatch inventory](../contract/MISMATCHES.md).

## Run locally

Install the web dependencies once:

```powershell
npm install --prefix web
```

In one PowerShell terminal, start the mock API using the steps in
[api-mock/README.md](../api-mock/README.md). In another terminal, start Vite:

```powershell
npm --prefix web run dev
```

Vite proxies `/api/*` to `http://127.0.0.1:8000` by default and removes the
`/api` prefix before forwarding. To use another development API:

```powershell
$env:API_TARGET = "http://127.0.0.1:8001"
npm --prefix web run dev
```

For a deployed UI, set `VITE_API_BASE_URL` to the API's reachable base URL
before building. If the browser calls a different origin, that server must
allow the UI origin; a same-origin reverse proxy is also suitable.

## Contract types and API behavior

`src/api/schema.d.ts` is generated from `../contract/openapi.json`:

```powershell
npm --prefix web run api:types
```

Regenerate the OpenAPI document from FastAPI first when API models or routes
change. Keep contract updates and the changelog in sync; do not make a
page-specific workaround for a server/contract mismatch.

The client uses `GET /health` feature negotiation to hide unsupported
navigation and disable unavailable report actions. The reviewer name is a
self-declared display value, not authentication. Browser exports are CSV and
XLSX; the API returns filtered report JSON.

## Validation

Run the web checks from the repository root:

```powershell
npm --prefix web run build
npm --prefix web run lint
npm --prefix web test
npx --prefix web playwright install --with-deps chromium
npm --prefix web run test:e2e
```

The Playwright configuration starts Vite and FastAPI on dedicated ports and
uses a unique temporary SQLite database. It does not use or reset the default
mock database. To select a Python executable for Playwright, set
`SCHEMA_MATCHER_PYTHON` to its absolute path before running the E2E command.
Python API tests run separately from `api-mock`:

```powershell
Set-Location api-mock
.\.venv\Scripts\python.exe -m pytest -q
```

`contract/smoke_test.py` accepts `--base-url` and `--feature-tier` for
read-only checks against a mock or a reachable real server. Use the feature
tiers advertised by that server's `/health`.

The latest run's command results, environment limits, and open sign-off gates
are recorded in
[the runtime validation report](../docs/ui-server-alignment/runtime-validation-report.md).

## Current integration limits

- The mock uses SQLite and deterministic fixtures. It does not implement
  embeddings, vector search, LLM judgment, or real asynchronous processing.
- `db/schema.sql` is reference PostgreSQL/pgvector DDL only. It has not been
  executed against a dedicated PostgreSQL test database.
- The real-server owner and reachable server were unavailable for contract
  conformance testing. The open status-transition and additive-field
  assumptions are listed in `contract/MISMATCHES.md`.
