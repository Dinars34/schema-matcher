# Contract mismatch inventory

Inventory taken from the v1.1.0 prose/examples, `openapi.json`,
`api-mock/app/{main,models,fixtures,database}.py`, `db/schema.sql`, and the
existing `web/src/api` request/response consumers on 2026-11-11.

The real-server owner was not available. Items below distinguish the behavior
implemented in the mock from assumptions that still need confirmation; do not
interpret this inventory as real-server conformance evidence.

| Area | Observed mismatch before implementation | Mock/contract action | Open item |
|---|---|---|---|
| Upload validation | Route checked only a case-sensitive extension; trusted the client filename; did not validate workbook bytes; hashed and wrote the upload under a name containing user input. | Sanitizes the displayed filename, bounds reads at 50 MiB + 1 byte, checks XLS/OLE workbook stream or XLSX ZIP workbook members, hashes and persists original bytes in SQLite. | PostgreSQL/object-storage persistence is not implemented or verified. |
| Upload response | FastAPI published an empty response schema although the route returned `job_id`, `submission_id`, name, size, hash, and status; upload example/Location behavior were incomplete. | Added `UploadResponse` and generated OpenAPI; retained the route's `Location: /jobs/{job_id}` response. | Whether every real server returns the same body fields needs verification. |
| Jobs | Job ID was derived from content hash; no job row was written; status/progress was synthesized from elapsed upload time. | Each upload stores a unique job row and deterministic terminal result linked to a unique submission. Scenario selection is mock-only. | Real asynchronous stages and processing transitions remain unspecified/unverified. |
| Submission/list models | List used untyped dictionaries; response omitted or inconsistently included `sha256`, `matched_file_name`, and `reason_short`; detail fabricated a proposal and schema. | Added typed summaries/detail, preserves stored proposal/decision and upload hash; filters, date range, ordering, and pagination are implemented. | `sha256` on detail and `entry_count` on dataset summaries are additive clarifications; confirm with the real-server owner before requiring these fields from it. |
| Decisions | Request model only allowed `action` and `note`; accepting `needs_review` always conflicted; reject returned the submission to `draft`; catalog and history were not changed. | Decision model includes optional manual verdict, target, note, reviewer; status and catalog effects are transactionally applied in SQLite. | Final status rules and whether rejection emits an audit event need confirmation. |
| Catalog/history | Routes returned hardcoded samples or empty history; datasets, entries, counts, search, and snapshots were not backed by data. | Catalog, entry detail, search, counts, paginated history, and before/after snapshots read/write the SQLite store. | Behavior is deterministic mock behavior, not a PostgreSQL test. |
| Reports | Route always returned an empty report and ignored filters/cap; browser consumer sent unsupported `format`/`scope` and expected either a file or unrelated success shape. | Server report JSON filters status/verdict/date/IDs/sort, enforces 100-ID and 1,000-row limits; web client requests JSON and creates sanitized CSV/XLSX downloads. | Real-server report support and field compatibility remain unverified. |
| Errors | Validation responses used FastAPI's default shape in OpenAPI; custom errors omitted `details`; route error responses were inconsistent. | All API errors use `code`, `message`, and nullable/structured `details`; routes declare their contract error models. | Legacy real server error responses are unverified. |
| Capabilities | Health example omitted `contract_version` and `features`; routes advertised catalog/history/report despite stub behavior. | Health reports v1.1.0 and only currently implemented mock feature tiers. | Real-server feature negotiation remains unverified. |
| Database | `database.py` hard-coded connection configuration; installed requirements did not declare the imported PostgreSQL driver. `db/schema.sql` contained destructive drops and invalid/incomplete SQL. | Removed credentials and database coupling from the runnable reference store; SQLite database path is configurable by `SCHEMA_MATCHER_MOCK_DB`. Replaced PostgreSQL schema with non-destructive reference DDL. | PostgreSQL 17 was reported running, but no dedicated test database/credentials were configured. No connection or PostgreSQL DDL execution was attempted. |
| OpenAPI | Checked-in file was stale relative to models and had incomplete schemas/errors and stub-era route metadata. | Regenerated from FastAPI using `api-mock/export_openapi.py`. | Must be compared with the real server's published v1.1.0 document. |

## Compatibility and assumptions

- The documented v1.1.0 routes, filter names, verdict names, job fields, and
  response pagination envelope remain the baseline.
- Existing prose describes manual verdict/target entry fields and `sha256`
  in an example, but the prior generated schema did not describe all of them.
  The OpenAPI artifact now reflects those documented fields.
- The mock uses immediate deterministic scenarios instead of real background
  analysis. `X-Mock-Scenario` is a test-only request header, omitted from
  published OpenAPI and unsupported by the real-server contract.
- `new_dataset`/`new_source` become accepted, `enrichment`/`duplicate` become
  merged, and reject becomes rejected. These status transitions follow the
  supplied workflow and are explicitly pending real-server confirmation.
- The PostgreSQL DDL describes the intended persistence model only. It has not
  been executed against PostgreSQL/pgvector, and the SQLite mock does not
  validate PostgreSQL-specific SQL or locking behavior.
