# Implementation Plan: Align Schema Matcher Web UI and Mock API

**Date**: 2026-11-11 | **Scope**: Refine the existing React web app and FastAPI mock so the UI follows the agreed schema-matching workflow and the mock is a reliable, contract-conformant stand-in for the real server.

## Summary

Make the versioned API contract the single boundary between the browser, mock API, and real server. Align upload, progress, proposal review, decisions, queue, catalog, history, and reports with the supplied implementation workflow. The mock should reproduce the workflow's externally observable behavior with deterministic scenarios; it should not pretend to run the real LLM or embedding models. The real server remains responsible for spreadsheet interpretation, Indonesian meaning generation, schema-card generation/validation, BGE-M3 embeddings, vector search, and LLM judgment.

## Implementation Status

The runnable mock and web client have been updated and validated with SQLite,
pytest, web build/lint/unit tests, and Playwright. The complete validation
evidence is in
[runtime-validation-report.md](./runtime-validation-report.md). The following
gates remain open rather than being represented as complete:

- The real-server owner and reachable server were unavailable; contract
  assumptions and production conformance still need confirmation.
- No dedicated PostgreSQL/pgvector test database was available, so PostgreSQL
  DDL, locking, and integration behavior remain unverified.
- The mock's SQLite transaction is implemented in the extracted decision
  service; SQLite serialization does not establish PostgreSQL row-lock behavior.
- The catalog now has dataset, entry, and detail selection panes; the original
  direct dataset/entry routes remain available for deep links.
- The mock deliberately does not implement embeddings or model-backed
  matching.

The supplied workflow is the business-flow reference:

1. Read the selected Excel sheet and normalize its rows/columns.
2. Produce a dataset meaning and a schema card; validate the card and retry once if invalid.
3. If the catalog is empty, create the initial accepted dataset/entry.
4. Otherwise, search accepted entries by vector similarity. Below the `0.60` threshold, propose `new_dataset`; otherwise run the judge and subsequent disaggregation/source/years/columns checks to produce `needs_review`, `new_source`, `enrichment`, or `duplicate`.
5. Keep the proposal in draft until a reviewer decides. Apply an accepted decision atomically to the submission, catalog, embedding where needed, and history. Rejection changes no catalog data.

The implementation sequence is contract and data invariants first, then vertical slices, then mock/real-server conformance. The codebase and the supplied plans do not contain a formal REQ-numbered feature specification or project constitution. The `REQ-XXX` entries below are therefore **planning IDs derived from the user's request, the v1.1 contract, web plan v2, prototype, and supplied workflow image**. Confirm them at the contract gate before implementation.

## Technical Context

**Language/Version**: TypeScript + React 19 + Vite 8; Python + FastAPI + Pydantic 2; PostgreSQL with `pgvector` required by the supplied matching workflow.

**Primary Dependencies**: React Router, TanStack Query, `openapi-fetch`, `openapi-typescript`, FastAPI, Pydantic, psycopg. Add focused test dependencies only during implementation: Vitest/Testing Library as appropriate, Playwright, and pytest.

**Storage**: PostgreSQL/pgvector is the target persistence layer; the runnable reference mock uses configurable SQLite and stores upload bytes there. Use PostgreSQL transactions and row-level locking in the real service; the reference DDL and PostgreSQL behavior remain unverified.

**Testing**: Python unit/API tests with pytest and FastAPI TestClient; PostgreSQL/pgvector integration tests; contract smoke/conformance tests; React unit tests for pure UI/data logic; Playwright browser journeys against the running Vite app and mock API.

**Target Platform**: Localhost web console and separately hosted real API; Vite proxy keeps browser requests same-origin in development/demo. A production-hosted UI would need an equivalent same-origin reverse proxy.

**Performance Goals**: No numeric SLO is specified. Preserve contract pagination limits, avoid detail requests per queue row, poll jobs at a bounded interval, and keep report exports within the contract's 1,000-row cap.

**Constraints**:
- Do not port the real matching engine into the mock. The mock uses deterministic fixtures/scenarios while preserving API shapes and decision/catalogue effects.
- Keep original upload bytes unchanged; compute and persist a SHA-256 digest; validate file type and the 50 MB limit.
- Do not silently change a published contract. If a mismatch requires a new field or altered behavior, update the contract version/changelog and regenerate OpenAPI before changing clients.
- `decided_by` is self-declared, not authentication.
- Keep user-visible copy in Indonesian and expose loading, empty, error, and conflict states.

### Planning requirements

| REQ ID | Requirement |
|---|---|
| REQ-001 | Upload `.xls`/`.xlsx` safely and byte-identically, with selected sheet, hash, and clear validation errors. |
| REQ-002 | Report job state using a stable API shape that survives refresh and supports the workflow's visible processing stages. |
| REQ-003 | Return and render proposal fields using the contract's canonical schema: verdict, similarity, reason, incoming schema card, and optional matched entry. |
| REQ-004 | Preserve the supplied matching decision order and thresholds in the real-server behavior; make the mock deterministic and scenario-driven. |
| REQ-005 | Require explicit manual verdict for `needs_review`; apply valid accept/reject decisions with the workflow's status semantics and no partial writes. |
| REQ-006 | Make queue rows, filters, ordering, pagination, and badge count use the same server-side criteria and totals. |
| REQ-007 | Model datasets and entries as distinct resources and navigate using the correct `dataset_id` and `entry_id`. |
| REQ-008 | Persist and display paginated history events with the contract's actor/time/before/after fields. |
| REQ-009 | Fetch report JSON according to contract filters and generate CSV/XLSX in the browser with safe cell handling. |
| REQ-010 | Keep the UI compatible with server capability negotiation and allow a controlled mock-to-real API swap. |
| REQ-011 | Provide coherent loading, empty, error, validation, conflict, keyboard, and responsive states across screens. |
| REQ-012 | Verify core journeys and API conformance with repeatable tests against the mock; make the same contract tests runnable against the real server. |
| REQ-013 | Generate/consume API types from the versioned OpenAPI document and remove fallback-shaped fake data that masks missing server fields. |

## Constitution Check

No `constitution.md` was found in the repository. Use these project constraints as the provisional gate:

| Principle | Result | Plan evidence |
|---|---|---|
| Contract-first integration | PASS | OpenAPI and contract docs are normalized before client/server refactoring; types are generated from OpenAPI. |
| The browser does not implement matching logic | PASS | Real engine stays behind API; mock uses deterministic outcomes only. |
| Preserve original file bytes | PASS | Upload integrity/hash checks and byte-identical download journey are explicit. |
| Decisions are atomic and idempotency/conflicts are visible | PASS | Transaction + row lock + conflict response + double-submit test. |
| Do not claim reviewer identity is authenticated | PASS | UI/contract copy identifies `decided_by` as a supplied display value. |
| Error paths are visible | PASS | No fake success fallback for missing response fields; tests cover API failures and invalid input. |

## Applied Guidelines

No project-local `skills/guidelines/` directory was found. Apply these implementation rules:

- Use Pydantic models and generated OpenAPI as the API source of truth; do not maintain a second handwritten wire schema in the UI.
- Keep request/response transport in `web/src/api/`; keep route components focused on rendering and interaction.
- Treat dataset IDs and entry IDs as distinct types/concepts even if both are strings.
- Use bound SQL parameters for values and a whitelist for dynamic sort expressions.
- Keep database decisions within one transaction and test rollback behavior.
- Do not substitute fabricated defaults for missing API fields; render a clear empty/error state or report a contract mismatch.

## Implementation Steps

### Phase 1: Foundational — normalize and freeze the integration contract

#### Plan 1.1: Confirm the canonical workflow and versioned API contract
- **Requirements**: REQ-001, REQ-002, REQ-003, REQ-005, REQ-007, REQ-008, REQ-009, REQ-010, REQ-013
- **Design inputs**: `contract/CONTRACT.md`, `contract/openapi.json`, `contract/CHANGELOG.md`, `schema-matcher-web-plan-v2.md`, supplied workflow image.
- **Description**: Compare all documented and implemented request/response fields. Record the canonical shapes for upload, job, submission/proposal, decision, dataset, entry, history, report, and health. Explicitly document workflow status transitions: empty-catalog initialization is accepted; accepted `new_dataset`/`new_source` proposals become accepted; accepted `enrichment`/`duplicate` proposals become merged; rejection becomes rejected and changes no catalog state. Confirm with the real-server owner before implementation. If an already handed-off v1.1 contract differs, create an additive versioned update rather than silently editing it. Make health capabilities match routes actually supported.

#### Plan 1.2: Generate and use contract-derived client types
- **Requirements**: REQ-003, REQ-010, REQ-013
- **Design inputs**: canonical OpenAPI from Plan 1.1; current `web/src/api/`.
- **Description**: Add a reproducible script to generate `web/src/api/schema.d.ts` from `contract/openapi.json`; use the already installed `openapi-fetch` client consistently. Normalize the Vite proxy under `/api` with one configurable target and a rewrite to contract paths. Remove duplicated ad hoc interfaces where generated types can represent the wire format; add explicit adapters only for UI view models.

**Tasks**
- [x] T001 [Plan:1.1] Inventory the existing OpenAPI, contract prose/examples, FastAPI models/routes, and web request/response types; record each mismatch in `contract/MISMATCHES.md`.
- [ ] T002 [Plan:1.1] Confirm the workflow's initial-empty-catalog behavior and status transitions with the real-server owner; update `contract/CONTRACT.md` and `contract/CHANGELOG.md` with the approved rules.
- [x] T003 [Plan:1.1] Define canonical upload, job, proposal, decision, catalog, history, report, health, pagination, and error response schemas in `api-mock/app/models.py`; include any approved additive fields and descriptions.
- [x] T004 [Plan:1.1] Update `api-mock/app/main.py` route declarations to match the canonical schemas and declare contract error responses; ensure health advertises only implemented features.
- [x] T005 [Plan:1.1] Re-export `contract/openapi.json` from the FastAPI app and update/add matching examples under `contract/examples/`.
- [x] T006 [Plan:1.2] Add an OpenAPI type-generation script and generated schema at `web/src/api/schema.d.ts`; wire it into a documented package command.
- [x] T007 [Plan:1.2] Configure `web/src/api/client.ts` and `web/vite.config.ts` for `/api` requests, a configurable `API_TARGET`, and proxy rewriting without changing the contract's endpoint paths.
- [x] T008 [Plan:1.1,1.2] Replace the existing partial `contract/smoke_test.py` checks with contract checks for required fields, status codes, filtering/pagination, and advertised capabilities; remove the stray `[cite: ...]` text.

### Phase 2: Foundational — persistence and deterministic mock behavior

#### Plan 2.1: Create persistence model for workflow state
- **Requirements**: REQ-001, REQ-005, REQ-007, REQ-008, REQ-012
- **Design inputs**: canonical data models from Plan 1.1; supplied workflow image; current `db/schema.sql`.
- **Description**: Repair the current schema and add datasets, entries, entry columns, vector embeddings (1024-dimensional for BGE-M3 compatibility), and entry-history storage. Add the required PostgreSQL vector extension setup and constraints/indexes. Preserve separate dataset and entry identifiers. Include submission decision/job linkage and transaction-safe status storage.

#### Plan 2.2: Make the mock a deterministic API reference, not a fake ML engine
- **Requirements**: REQ-002, REQ-003, REQ-004, REQ-012
- **Design inputs**: canonical response models; `api-mock/app/fixtures.py`; supplied workflow image.
- **Description**: Keep model/embedding/vector-search implementation out of the mock. Create named, deterministic test scenarios for empty catalog, each verdict, failed processing, and manual review. Return the same observable job/proposal/catalog shapes the real server must return. Use fixtures rather than unreliable file-name inference or placeholder response values.

**Tasks**
- [x] T009 [Plan:2.1] Repair `db/schema.sql` and define datasets, entries, entry columns, embeddings, history, submission decisions, and job persistence with foreign keys/check constraints/indexes.
- [ ] T010 [Plan:2.1] Add PostgreSQL/pgvector initialization and migration/bootstrap instructions for the mock database without embedding credentials in source.
- [x] T011 [Plan:2.2] Replace implicit hash-derived fake-job behavior in `api-mock/app/main.py` with deterministic persisted job records linked to submissions and fixture scenario outcomes.
- [x] T012 [Plan:2.2] Expand `api-mock/app/fixtures.py` to cover empty-catalog initialization, all five verdicts, failed job, rejected decision, and conflict/idempotency cases.
- [x] T013 [Plan:2.2] Implement contract-shaped upload validation and persistence in `api-mock/app/main.py`: safe filename handling, extension/content validation, 50 MB limit, SHA-256, unchanged bytes, and explicit error responses.
- [x] T014 [Plan:2.1,2.2] Add pytest coverage for schema constraints, upload integrity/limits, job persistence, and fixture scenario responses.

### Phase 3: P1 — upload, progress, and proposal review

#### Plan 3.1: Align upload and progress UI with actual API data
- **Requirements**: REQ-001, REQ-002, REQ-011, REQ-012, REQ-013
- **Design inputs**: canonical upload/job contract; workflow steps; prototype upload/progress views.
- **Description**: Read the selected workbook in the browser for actual sheet names and preview rows; do not send a data dictionary. Submit original bytes and selected sheet. Follow the returned job link/ID; poll with cleanup and stop at terminal states; show server-provided stage/progress/message rather than fake 55% progress or hardcoded stages. Preserve direct-link/refresh support.

#### Plan 3.2: Render proposals and decisions from the canonical contract
- **Requirements**: REQ-003, REQ-005, REQ-011, REQ-012, REQ-013
- **Design inputs**: `Proposal`, `SchemaCard`, `EntryRef`, and decision models from Plan 1.1; prototype review pane.
- **Description**: Remove fallback proposal/schema/score data in `SubmissionDetailPage.tsx`. Display the server's reason and schema cards. Require a manual verdict for `needs_review`; send only contract fields. Show 409/422 details and disable duplicate submission while the request is pending.

**Tasks**
- [x] T015 [Plan:3.1] Update `web/src/api/upload.ts` to use generated API types, honor the upload response/Location contract, and reject malformed success responses rather than substituting a fake job ID.
- [x] T016 [Plan:3.1] Implement selected-file sheet discovery and real preview rows in `web/src/pages/UploadPage.tsx`; remove the default filename, fake sample rows, and hardcoded sheet choices.
- [x] T017 [Plan:3.1] Align `web/src/api/jobs.ts` with the canonical job response and make polling in `web/src/pages/ProgressPage.tsx` refresh-safe, cancellable, terminal-state-aware, and free of hardcoded progress/step fallbacks.
- [x] T018 [Plan:3.2] Replace loose `Record<string, unknown>` casts and mock schema fallbacks in `web/src/pages/SubmissionDetailPage.tsx` with contract-derived proposal types and explicit loading/not-found/error states.
- [x] T019 [Plan:3.2] Align `web/src/api/review.ts` decision payload and response handling with manual verdict, target entry, note, reviewer name, and conflict/error rules.
- [x] T020 [Plan:3.1,3.2] Add browser tests for upload-to-job-to-proposal, invalid upload, failed job, and `needs_review` manual-verdict/409 handling.

### Phase 4: P1/P2 — submissions list and needs-review queue

#### Plan 4.1: Make list filtering and queue totals server-authoritative
- **Requirements**: REQ-005, REQ-006, REQ-011, REQ-012
- **Design inputs**: canonical submission query/filter/page model; web plan v2 queue specification.
- **Description**: Move search/filter/sort/date criteria to supported API query parameters. Keep table rows and total from the same query. Use the same draft + needs_review filter for the queue page and sidebar count. Refresh/invalidate queue/list/detail/catalog queries after every decision; ensure the badge updates without relying on navigating away and back.

**Tasks**
- [x] T021 [Plan:4.1] Add typed server-side query parameters and response parsing to `web/src/api/submissions.ts`, including search/date/sort only where the approved contract supports them.
- [x] T022 [Plan:4.1] Update `web/src/pages/SubmissionsPage.tsx` so filters, search, pagination, selection count, loading, empty, and error state reflect server totals and applied filters.
- [x] T023 [Plan:4.1] Update `web/src/pages/NeedsReviewPage.tsx` to show candidate/reason/age fields only when present in the contract, use the canonical queue sort, open the shared manual-decision flow for a selected submission, and show pagination/empty/error states.
- [x] T024 [Plan:4.1] Replace the one-time location-key badge refresh in `web/src/components/AppLayout.tsx` with shared query state/refetch and an agreed refresh interval; invalidate it after decisions.
- [x] T025 [Plan:4.1] Add API and browser tests proving badge total equals the queue's matching server total and decreases after a successful decision.

### Phase 5: P2 — catalog navigation and history

#### Plan 5.1: Use distinct dataset and entry resources
- **Requirements**: REQ-007, REQ-011, REQ-012, REQ-013
- **Design inputs**: `DatasetPage`, `EntryPage`, `EntryDetail`; current `/catalog/*` routes; web plan v2 three-pane design.
- **Description**: Replace the single ambiguous dataset table with the planned dataset → entries → selected-entry detail panes and contract-backed dataset/column search. Use `dataset_id` only for dataset routes and `entry_id` only for entry detail/history. Match the contract's `data_type` field and avoid `unknown` identifiers or fallback IDs.

#### Plan 5.2: Match history UI to event snapshots and pagination
- **Requirements**: REQ-008, REQ-011, REQ-012, REQ-013
- **Design inputs**: canonical `HistoryEvent` / `HistoryPage`; `entry_history` storage; supplied workflow's atomic update effects.
- **Description**: Store each effective accepted catalog decision with before/after snapshots, timestamp, action, submission, and self-declared reviewer label. Display newest-first paginated events and meaningful diffs. The initial empty-catalog auto-accept path must follow the approved contract's history rule.

**Tasks**
- [x] T026 [Plan:5.1] Update `web/src/api/catalog.ts` and add typed dataset, entry-list, entry-detail, and debounced search request functions based on the canonical OpenAPI schemas.
- [x] T027 [Plan:5.1] Refactor `web/src/pages/CatalogPage.tsx` into dataset/entry/detail selection panes and use the correct IDs for every navigation action.
- [x] T028 [Plan:5.1] Align `web/src/api/catalogDetail.ts` and `web/src/pages/CatalogDetailPage.tsx` with contract fields such as `entry_id` and column `data_type`; add stale-request cleanup and invalid-ID handling.
- [x] T029 [Plan:5.2] Implement catalog mutations and history insertion in a single transaction in the mock decision service; ensure rollback leaves no partial catalog, submission, embedding, or history updates.
- [x] T030 [Plan:5.2] Implement paginated history response mapping from `before_state`/`after_state` to API `before`/`after` in `api-mock/app/main.py`.
- [x] T031 [Plan:5.2] Update `web/src/api/history.ts` and `web/src/pages/EntryHistoryPage.tsx` to consume `items/total/page/page_size`, `decided_at`, `decided_by`, and snapshots; remove `actor`/`timestamp`/`notes` assumptions.
- [x] T032 [Plan:5.1,5.2] Add API and browser tests for dataset→entry→detail navigation, empty catalog, history snapshots, pagination, and invalid identifiers.

### Phase 6: P2 — decision transaction and catalog rules

#### Plan 6.1: Implement decision semantics from the supplied workflow
- **Requirements**: REQ-004, REQ-005, REQ-007, REQ-008, REQ-012
- **Design inputs**: workflow image; decision/entry/history contracts; current `api-mock/app/main.py`.
- **Description**: Apply decisions under `SELECT ... FOR UPDATE` and one transaction. `reject` sets rejected and does not change catalog. `new_dataset` creates dataset/entry; `new_source` adds an entry to the matched dataset; `enrichment` unions missing columns/years and updates the embedding only when its input text changes; `duplicate` changes no catalog fields. Set final status according to the agreed workflow. `needs_review` cannot be accepted until reviewer selects a permitted verdict. Use 404/409/422 consistently.

**Tasks**
- [x] T033 [Plan:6.1] Extract transaction-scoped decision logic from `api-mock/app/main.py` into a service module with a locked submission read, validation, per-verdict catalog operation, status update, decision record, and history write.
- [x] T034 [Plan:6.1] Implement `new_dataset`, `new_source`, `enrichment`, and `duplicate` effects using the canonical proposal and target-entry data; preserve column/year uniqueness. Embedding mutations remain outside the deterministic mock, as the real matching engine owns embeddings.
- [x] T035 [Plan:6.1] Implement reject and `needs_review` manual-verdict validation with the canonical final statuses and stable 404/409/422 error contract.
- [x] T036 [Plan:6.1] Add transaction tests for each verdict, catalog immutability on reject/duplicate, missing manual verdict/target, double decision, and forced mid-transaction failure rollback.

### Phase 7: P2 — report and connection/settings

#### Plan 7.1: Use report JSON contract and generate files in-browser
- **Requirements**: REQ-009, REQ-011, REQ-012, REQ-013
- **Design inputs**: `ReportData`; contract's filters and 1,000-row cap; web plan v2 export design.
- **Description**: Send only supported report filters (status, verdict, date range, IDs, sort). The server returns JSON; the browser builds CSV/XLSX. Remove unsupported format/scope server parameters and PDF claims unless explicitly added to a later contract. Sanitize spreadsheet formula-like values and handle `report_too_large`.

#### Plan 7.2: Negotiate server capabilities and show truthful connection state
- **Requirements**: REQ-010, REQ-011, REQ-013
- **Design inputs**: `HealthResponse`; current `ConnectionPage.tsx`, `AppLayout.tsx`, and `vite.config.ts`.
- **Description**: Use health contract version/features to show connection and hide/disable unsupported feature links with a useful explanation. Add a reviewer-name setting persisted in local storage and send it as the self-declared `decided_by` value; do not imply authentication. Keep server target configuration out of committed secrets.

**Tasks**
- [x] T037 [Plan:7.1] Replace `web/src/api/reports.ts` request types/handling with generated `ReportData` filters and remove file-stream/JSON ambiguity.
- [x] T038 [Plan:7.1] Add pure CSV/XLSX row-building and cell-sanitizing functions under `web/src/lib/`, with focused tests and supported-format UI controls in `web/src/pages/ReportPage.tsx`.
- [x] T039 [Plan:7.1] Implement mock report filtering, sorting, IDs validation, deterministic output, and the 1,000-row 422 cap in `api-mock/app/main.py`.
- [x] T040 [Plan:7.2] Type health data from generated OpenAPI; add the reviewer-name setting and update `web/src/pages/ConnectionPage.tsx` and `web/src/components/AppLayout.tsx` for truthful capability-based navigation/connection status.
- [x] T041 [Plan:7.1,7.2] Add API/UI tests for report filters, cap errors, CSV injection-safe output, feature negotiation, and unavailable-server behavior.

### Phase 8: Final — usability, conformance, and real-server swap

#### Plan 8.1: Complete consistent UI states and accessibility
- **Requirements**: REQ-011, REQ-012
- **Design inputs**: prototype visual language; existing common components and CSS.
- **Description**: Normalize page headers, spacing, Indonesian labels, date/number formatting, responsive panes, button pending states, empty/error/loading messages, keyboard focus, and status text. Do not rely on color alone. Remove stale placeholder values and misleading “connected” status when health has not succeeded.

#### Plan 8.2: Run the same conformance suite against mock and real server
- **Requirements**: REQ-010, REQ-012, REQ-013
- **Design inputs**: versioned OpenAPI, contract smoke suite, all acceptance journeys.
- **Description**: Make base URL configurable without editing page code. Run contract/smoke checks against mock first, then each real-server feature tier claimed by `/health`. Record every mismatch; correct the server or API adapter, not individual pages. Retain the mock as a reproducible fallback.

**Tasks**
- [x] T042 [Plan:8.1] Review all pages/components for loading, empty, error, conflict, retry, focus, labeling, responsive layout, and status-by-text behavior; remove hardcoded examples from runtime states.
- [x] T043 [Plan:8.2] Add Playwright journeys for upload→progress→review→decision, queue count/list consistency, catalog/history persistence, and report download.
- [ ] T044 [Plan:8.2] Extend `contract/smoke_test.py` or a companion script to accept a configurable base URL and feature tier; run the same checks against the mock and the real server.
- [x] T045 [Plan:8.2] Document mock startup, PostgreSQL/pgvector setup, test commands, API target selection, contract version, feature tiers, and mismatch triage in `web/README.md` and `contract/CONTRACT.md`.
- [ ] T046 [Plan:8.1,8.2] Run and record web build/lint, Python tests, PostgreSQL integration tests, contract smoke tests, and Playwright journeys; do not mark a journey complete when its prerequisite tier was skipped.

## Project Structure

```text
contract/
  CONTRACT.md
  CHANGELOG.md
  openapi.json
  examples/
  smoke_test.py
  MISMATCHES.md
db/
  schema.sql
api-mock/
  app/
    main.py
    models.py
    services/
      decisions.py
      submissions.py
    fixtures.py
  tests/
    test_contract.py
    test_uploads.py
    test_jobs.py
    test_decisions.py
    test_catalog_history.py
    test_reports.py
web/
  src/
    api/
      client.ts
      schema.d.ts
      submissions.ts
      upload.ts
      jobs.ts
      review.ts
      catalog.ts
      catalogDetail.ts
      history.ts
      reports.ts
    lib/
      reportExport.ts
    pages/
    components/
  e2e/
```

Only add service modules and tests when the corresponding plan step is implemented; this is the target organization, not a requirement to create empty files up front.

## Testing Strategy

### Application type

Mixed system: React/Vite SPA plus FastAPI JSON API and PostgreSQL/pgvector persistence.

### Critical journeys

1. Select an Excel file, inspect its real sheets/preview, upload, verify byte/hash integrity, poll to terminal job state, and open the proposal.
2. Accept enrichment and verify years/columns, submission status, and history snapshot changed atomically.
3. Resolve `needs_review` with an explicit manual verdict; verify invalid/missing choices return contract errors and the queue count updates.
4. Reject a proposal; verify rejected state is visible and catalog data is unchanged.
5. Browse dataset → entry → detail/history and export filtered JSON as CSV/XLSX; verify identifiers, filters, history fields, and safe spreadsheet cells.

### Primary validation stack

- **API unit/integration**: pytest + FastAPI TestClient; PostgreSQL with pgvector for persistence, SQL, vector schema, and transaction behavior.
- **Contract**: generated OpenAPI validation plus `contract/smoke_test.py` using a configurable base URL.
- **Browser**: Playwright against the running Vite app and mock API, covering all critical journeys.
- **Build/static checks**: `npm run build`, `npm run lint`, Python syntax/import checks, and pytest.
- Existing top-level test assets: `contract/smoke_test.py`; no web browser test suite or Python pytest suite was found. Web package currently has build/lint scripts but no test script.

### Infrastructure and fallback matrix

| Capability | Primary | Fallback | Gap |
|---|---|---|---|
| Database | PostgreSQL + pgvector, preferably Docker-managed for repeatable test setup | A configured local PostgreSQL with the same extension | If neither is available, database/transaction/vector integration is **UNVERIFIED**; SQLite/in-memory tests cannot certify pgvector or PostgreSQL locking semantics. |
| Browser | Playwright Chromium (Node.js is available in the current environment) | Browser journey is not replaced by API probes; report it as unverified if browser setup fails | No visual, routing, browser fetch, or file-download evidence. |
| Real matching models | Not required for mock/API tests; deterministic scenario fixtures | None for validating actual matching quality; run separately against the real model server | Mock results cannot establish LLM, embedding, threshold, or retrieval quality. |
| Real API | Same contract suite against real API URL and advertised feature tiers | Mock API for UI development only | Mock pass does not prove real-server conformance. |

**Current planning environment check**: Node.js `v24.12.0` is available. Docker is unavailable because its daemon is not responding or the CLI is absent. Before implementation, verify whether local PostgreSQL with pgvector is usable; otherwise arrange a working Docker service. Do not downgrade DB fidelity silently.

### External dependency strategy and test scaffolding

- PostgreSQL/pgvector: use a dedicated test database, unique IDs per test, transactions or explicit cleanup, and a known schema/extension version. No developer sandbox database may be truncated by tests.
- File storage: use a temporary test directory; assert downloaded bytes equal uploaded bytes; always clean test files.
- Frontend-to-backend boundary: run the FastAPI mock as an HTTP service for browser tests; use contract-derived request/response fixtures for frontend unit tests.
- LLM/embedding/vector engine: deterministic mock fixtures for UI and contract tests; do not mock away PostgreSQL transaction tests. Actual model evaluation is a separate real-server validation.
- Test base/helpers: shared pytest app/database/storage fixtures and Playwright fixtures for server readiness, scenario seeding, and cleanup. Each implementation task runs its focused tests and reports pass/fail/skip counts.
- Test assets: preserve and repair the API smoke test; no legacy E2E assets were found, so author the browser suite rather than migrating one.

### Acceptance criteria

- Contract examples validate against generated OpenAPI; mock endpoints return those shapes and documented errors.
- Upload content digest and download bytes match; invalid type/oversize requests return documented errors.
- Job polling terminates on completed/failed and never renders fabricated default progress.
- A `needs_review` accept without manual verdict is rejected; valid accept/reject decisions make the correct status/catalog/history changes exactly once.
- A forced error midway through an accepted catalog decision leaves no partial state.
- Queue table total and sidebar badge derive from the same server query and match after a decision.
- Catalog navigation never uses `dataset_id` as `entry_id`.
- History displays `decided_at`, `decided_by`, and before/after snapshots from the API.
- Report requests use only contract filters; the client downloads CSV/XLSX; over-cap responses and formula-like cells are handled safely.
- Mock and real server pass the exact same supported-tier smoke suite; unsupported features are not presented as available.

### Known gaps and review expectations

- The real server is outside the repository; the swap cannot be certified until its owner provides a reachable endpoint and supported feature list. T002 and the real-server portion of T044 remain open.
- The workflow image describes matching internals, but does not define every wire-level job field or the exact history event for an initial empty-catalog auto-accept. Confirm these details with the server owner before declaring final contract conformance.
- `decided_by` is a client-provided display label. Authentication/authorization is not specified in the supplied contract and must be designed separately for production.
- The SQLite mock persists submissions, jobs, catalog entries, decisions, and history, and its transaction rollback is tested through the extracted decision service. SQLite `BEGIN IMMEDIATE` is the mock's write serialization mechanism; it is not evidence of PostgreSQL row-lock behavior.
- The mock does not implement embeddings, vector search, LLM judgment, or real asynchronous processing; named fixtures validate API/UI behavior only. Embedding-update behavior remains a real-server concern.
- PostgreSQL/pgvector DDL is a non-destructive reference schema only; no dedicated test database or connection credentials were supplied. PostgreSQL schema, locking, and transaction behavior remain unverified, so T010 and T046 remain open.
- Final review must verify that no page duplicates API transport logic, no UI fallback masks an absent contract field, every decision writes all required records atomically, and all test evidence states which environment (mock vs real) was used.

## Requirement Mapping

| REQ ID | Description | Plan Items | Implementation Evidence |
|---|---|---|---|
| REQ-001 | Safe, byte-identical Excel upload with actual sheet/preview handling | 1.1, 2.1, 2.2, 3.1 | `api-mock/app/main.py`, `db/schema.sql`, `web/src/pages/UploadPage.tsx`, `web/src/api/upload.ts`, upload tests |
| REQ-002 | Stable refresh-safe job status and progress stages | 1.1, 2.2, 3.1 | `api-mock/app/models.py`, `api-mock/app/main.py`, `web/src/api/jobs.ts`, `web/src/pages/ProgressPage.tsx` |
| REQ-003 | Contract-shaped proposal display | 1.1, 1.2, 3.2 | `web/src/api/schema.d.ts`, `web/src/api/review.ts`, `web/src/pages/SubmissionDetailPage.tsx` |
| REQ-004 | Supplied matching workflow represented without fake ML in mock | 2.2, 6.1 | `api-mock/app/fixtures.py`, decision service, workflow scenario tests |
| REQ-005 | Valid manual decisions and atomic state transitions | 1.1, 2.1, 3.2, 4.1, 6.1 | decision models/service, catalog DB tables, review UI, transaction tests |
| REQ-006 | Matching queue/list filters, totals, badge, and refresh | 4.1 | `web/src/api/submissions.ts`, `web/src/pages/SubmissionsPage.tsx`, `web/src/pages/NeedsReviewPage.tsx`, `web/src/components/AppLayout.tsx` |
| REQ-007 | Separate dataset and entry identity/navigation | 2.1, 5.1, 6.1 | `db/schema.sql`, `web/src/api/catalog.ts`, `web/src/pages/CatalogPage.tsx`, catalog API tests |
| REQ-008 | Contract-shaped, persisted paginated history | 2.1, 5.2, 6.1 | `db/schema.sql`, mock decision service/history route, `web/src/api/history.ts`, `web/src/pages/EntryHistoryPage.tsx` |
| REQ-009 | Contract-filtered JSON report and safe browser-side CSV/XLSX | 7.1 | `web/src/api/reports.ts`, `web/src/lib/reportExport.ts`, `web/src/pages/ReportPage.tsx`, report tests |
| REQ-010 | Feature negotiation and mock-to-real swap | 1.1, 1.2, 7.2, 8.2 | `web/vite.config.ts`, `web/src/api/client.ts`, health UI, configurable smoke test |
| REQ-011 | Consistent resilient and accessible UI states | 3.1, 3.2, 4.1, 5.1, 5.2, 7.2, 8.1 | all page components, shared components/styles, Playwright evidence |
| REQ-012 | Repeatable mock, database, contract, and browser validation | 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 6.1, 7.1, 8.2 | pytest suite, PostgreSQL integration suite, smoke suite, Playwright suite |
| REQ-013 | Generated API types and no misleading fallback data | 1.1, 1.2, 3.1, 3.2, 5.1, 5.2, 7.1, 7.2, 8.2 | `web/src/api/schema.d.ts`, typed API modules, build/lint, contract tests |
