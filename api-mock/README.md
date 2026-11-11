# Schema Matcher mock API

The mock is a deterministic contract/reference server, not an implementation of
the production matching engine. Its default store is SQLite at
`api-mock/data/mock.sqlite3`; set `SCHEMA_MATCHER_MOCK_DB` to another SQLite
file path to use a separate store. Uploaded bytes are kept unchanged in that
database, with a SHA-256 digest. Do not point automated tests at a developer
database.

## Run locally

From `api-mock`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API listens at `http://127.0.0.1:8000`. `GET /openapi.json` serves the
live FastAPI document. Regenerate the checked-in contract artifact after API
model/route changes:

```powershell
.\.venv\Scripts\python.exe export_openapi.py
```

## Deterministic scenarios

Uploads default to `new_dataset` when the catalog is empty and `enrichment`
otherwise. Tests and local mock exploration may select one of
`new_dataset`, `new_source`, `enrichment`, `duplicate`, `needs_review`, or
`failed_job` with the mock-only `X-Mock-Scenario` header. Matched scenarios
create a fixture catalog target if one does not exist. Jobs are persisted and
return the selected deterministic outcome; no LLM, embedding, or asynchronous
matching work is performed.

## Tests

From `api-mock`, run:

```powershell
.\.venv\Scripts\python.exe -m pip install pytest
.\.venv\Scripts\python.exe -m pytest
```

`pytest` is a test-only dependency and is not part of the runtime requirements.
The API tests create an isolated shared in-memory SQLite database and do not
reset or connect to a developer database.

## PostgreSQL reference schema

`..\db\schema.sql` describes the intended PostgreSQL/pgvector persistence model.
It is **not** used by the runnable mock and has not been applied or validated
against PostgreSQL 17/pgvector. The PostgreSQL service being available does
not identify a safe test database; no configured developer database is read or
mutated by this mock. To validate PostgreSQL, first provision a dedicated
throwaway database and explicitly configure connection settings without
committing credentials. Apply the schema only to that new database; it contains
no table drops. `pgvector` must be installed and its extension available.

The mock's SQLite transaction tests do not establish PostgreSQL
`SELECT ... FOR UPDATE`, SQL syntax, or pgvector correctness. See the contract
mismatch inventory for remaining real-server and PostgreSQL verification.
