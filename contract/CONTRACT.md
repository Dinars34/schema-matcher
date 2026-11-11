# Schema Matcher API Contract (v1.1.0)

This document describes the compatibility baseline used by the mock API. It
does not claim that a real server has been verified against these behaviors.
The real-server owner was unavailable during this implementation; assumptions
and known divergences are recorded in [MISMATCHES.md](MISMATCHES.md).

## Base URL

- Mock development server: `http://127.0.0.1:8000`
- Contract paths are rooted at `/`; development proxies may add and remove a
  prefix without changing these paths.

## Capabilities (`GET /health`)

Returns `status`, server `version`, `contract_version` (`"1.1.0"`), and the
implemented feature list. The mock advertises `queue`, `catalog`, `history`,
and `report` because each route has persistent behavior. A real server should
advertise only capabilities it actually supports.

## Endpoints

| Method & path | Success | Contract errors | Feature |
|---|---:|---|---|
| `GET /health` | 200 | — | Core |
| `GET /submissions` | 200 | 422 | Queue |
| `POST /submissions` | 202 | 400, 413, 415, 422 | Core |
| `GET /submissions/{submission_id}` | 200 | 404, 422 | Core |
| `GET /submissions/{submission_id}/file` | 200 | 404, 422 | Core |
| `GET /jobs/{job_id}` | 200 | 404, 422 | Core |
| `POST /submissions/{submission_id}/decision` | 200 | 404, 409, 422 | Queue |
| `GET /catalog/datasets` | 200 | 422 | Catalog |
| `GET /catalog/datasets/{dataset_id}/entries` | 200 | 404, 422 | Catalog |
| `GET /catalog/entries/{entry_id}` | 200 | 404, 422 | Catalog |
| `GET /catalog/entries/{entry_id}/history` | 200 | 404, 422 | History |
| `GET /catalog/search?q=...` | 200 | 422 | Catalog |
| `GET /reports/submissions` | 200 | 422 | Report |

Contract errors use `ErrorResponse`:

```json
{"code":"not_found","message":"Entry not found.","details":null}
```

Request validation errors use the same top-level shape and place FastAPI's
validation issue objects in `details`.

## Upload and jobs

`POST /submissions` accepts multipart `file` and optional `sheet`. Only valid
`.xls` and `.xlsx` workbook content is accepted; maximum file size is 50 MiB.
The uploaded bytes are stored unchanged and SHA-256 is calculated over those
bytes. Success is `202 Accepted`, includes `job_id`, `submission_id`,
`file_name`, `size_bytes`, `sha256`, and `status`, and sets `Location` to
`/jobs/{job_id}`.

`GET /jobs/{job_id}` returns `job_id`, `status` (`processing`, `completed`, or
`failed`), `progress` (0–100), and `message`. The reference mock completes
deterministic scenarios immediately; it does not run the real matching engine.

## Listing, reports, and pagination

Pagination uses `page` (minimum 1, default 1) and `page_size` (1–100, default
10). `/submissions` supports `status`, `verdict`, inclusive UTC date filters
`uploaded_from` / `uploaded_to` (`YYYY-MM-DD`), and `sort` (`uploaded_at` or
`-uploaded_at`; default `-uploaded_at`). The response contains `items`, `total`,
`page`, and `page_size`. Submission summaries include the upload metadata,
status/verdict/similarity, and optional `matched_file_name` and `reason_short`.

Dataset and entry lists use the same pagination response. Dataset summaries
include their current `entry_count`. History is paginated and maps persisted
snapshots to API fields `before` and `after`.

`GET /reports/submissions` returns JSON (`generated_at`, `total`, `rows`) and
supports `status`, `verdict`, date range, comma-separated `ids` (maximum 100),
and `sort`. More than 1,000 matching rows returns 422 with
`code: "report_too_large"`. File-format generation is a client responsibility.

## Decisions and catalog effects

`POST /submissions/{submission_id}/decision` accepts `action` (`accept` or
`reject`), optional manual `verdict`, optional `target_entry_id`, `note`, and
`decided_by`. `decided_by` is a self-declared display value, not authentication.
Accepting a `needs_review` proposal without an explicit manual verdict returns
409. A second decision on an already decided submission also returns 409.

The mock applies these assumed transitions pending confirmation by the
real-server owner:

- `new_dataset`: create a dataset and entry; submission becomes `accepted`.
- `new_source`: add an entry under the matched dataset; submission becomes
  `accepted`.
- `enrichment`: union new years and columns into the target; submission becomes
  `merged`.
- `duplicate`: leave catalog fields unchanged and record equal before/after
  snapshots; submission becomes `merged`.
- `reject`: submission becomes `rejected`; catalog is unchanged.

Accept operations, decision recording, submission status, and history insertion
are atomic in the SQLite reference store. This is not evidence that PostgreSQL
locking or transaction behavior has been integration-tested.

## Matching boundary

The mock returns named deterministic fixtures only. The real server remains
responsible for workbook interpretation, Indonesian meaning generation, schema
card generation/validation, BGE-M3 embeddings, vector search, and LLM judgment.
