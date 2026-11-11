# Planning Research: UI and Mock API Alignment

## Decisions

### Decision: Treat the supplied workflow image as the business-flow reference

- **Decision**: Preserve its order: sheet extraction and normalization; meaning generation; schema-card generation/validation; initial empty-catalog path; vector search against accepted entries; threshold/judge/disaggregation/source/years/columns checks; proposal; reviewer decision; atomic catalog/history update.
- **Rationale**: The image was explicitly supplied as the server implementation workflow and gives more specific business behavior than the current stub routes.
- **Alternatives considered**: Treat the current mock implementation as authoritative. Rejected because its upload/job/decision/catalog behavior is partial and differs from the supplied flow.

### Decision: Keep matching models out of the mock

- **Decision**: Use deterministic scenario fixtures to exercise the API and UI. Real LLM, BGE-M3, and vector matching stay in the separately implemented server.
- **Rationale**: The web plan defines the mock as a reference implementation, not the matching engine; deterministic fixtures make conformance repeatable without pretending to validate model quality.
- **Alternatives considered**: Add LLM/embedding dependencies to the mock. Rejected because it duplicates production responsibilities and makes UI tests costly/non-deterministic.

### Decision: Keep datasets and entries as separate resources

- **Decision**: The catalog browser selects a dataset, then an entry, and uses `dataset_id` and `entry_id` only with their corresponding endpoints.
- **Rationale**: OpenAPI and FastAPI models define separate dataset and entry identifiers; current UI conflates them.
- **Alternatives considered**: Treat a dataset as an entry. Rejected because the contract has distinct dataset, entry, and history routes.

### Decision: Keep report file generation in the browser

- **Decision**: Server returns contract-shaped JSON; web app builds CSV/XLSX. Do not present PDF unless it is separately specified and contracted.
- **Rationale**: This is the v1.1 contract/web-plan design and avoids adding server-side document-generation behavior.
- **Alternatives considered**: Server streams format-selected report files. Rejected because it conflicts with the current `ReportData` contract and creates multiple server responsibilities.

## Items to confirm at the contract gate

These are not implementation assumptions to silently resolve:

1. Confirm with the real-server owner that an upload against an empty catalog creates an accepted catalog entry without reviewer action.
2. Confirm that accepted `new_dataset`/`new_source` submissions end in `accepted`, while `enrichment`/`duplicate` end in `merged`, as shown in the workflow image.
3. Confirm whether an empty-catalog auto-accept creates an `entry_history` event, and what action/actor values it records.
4. Agree on exact job response fields for refresh-safe progress: stage, human-readable message, file name, submission ID, terminal error, and whether a stage list is part of the public API.
5. Confirm that the real server's similarity threshold is 0.60 and that only accepted catalog entries are eligible vector-search candidates. Keep these engine-specific details out of the UI contract unless the real server owner wants them exposed.
6. Confirm whether contract v1.1 has already been handed off. If so, publish an additive versioned update for any response/request shape changes; do not rewrite the handed-off version silently.

## Repository evidence and constraints

- Existing implementation plan v2 covers the web direction and stretch features, but it does not provide a formal `REQ-XXX` feature spec.
- No repository constitution, architecture artifacts, test suite for the web app, or pytest suite was found.
- `contract/CONTRACT.md` states v1.1; its examples and `contract/openapi.json` do not cover every v1.1 workflow detail.
- `api-mock/app/models.py` has a minimal decision request and job response; `api-mock/app/main.py` has placeholder catalog/history/report behavior.
- `db/schema.sql` currently contains only submissions/jobs and has a trailing comma in the jobs table definition.
- Web package uses React/Vite/TypeScript, React Router, TanStack Query, and `openapi-fetch`; build/lint scripts exist, but no web test script exists.
- `web/src/api/reports.ts`, `history.ts`, catalog page types, and progress page expect shapes that differ from the documented API.
- Test environment capability probe: Node.js `v24.12.0` is available; Docker is unavailable (CLI absent or daemon not responding). PostgreSQL/pgvector availability was not verified.
