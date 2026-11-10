# Schema Matcher API Contract (v1.1.0)

This document defines the interface and business rules for the Schema Matcher backend service. Contract v1.1.0 is strictly additive relative to v1.0.0.

## Base URL
- Development / Mock: `http://127.0.0.1:8000`

---

## Feature Flags & Capabilities (`GET /health`)
- The server advertises its contract version (`"1.1.0"`) and active capabilities via `features`[cite: 2].
- Supported feature flags: `"queue"`, `"catalog"`, `"history"`, `"report"`[cite: 2].
- Connected clients inspect `features` to render only the UI screens supported by the backend[cite: 2].

---

## Endpoints Overview

| Method & Path | Summary | Success Status | Error Responses | Feature Tier |
|---|---|---|---|---|
| `GET /health` | System health, version, and feature flags | `200 OK` | - | Core (v1.0) |
| `GET /submissions` | List submissions with filters, date range, sort & pagination | `200 OK` | `422` | Core / Queue |
| `POST /submissions` | Upload raw Excel file (multipart) | `202 Accepted` | `400`, `413`, `415`, `422` | Core (v1.0) |
| `GET /submissions/{id}` | Get submission detail, proposal, and decision record | `200 OK` | `404`, `422` | Core (v1.0) |
| `GET /submissions/{id}/file` | Download original binary file | `200 OK` | `404`, `422` | Core (v1.0) |
| `GET /jobs/{job_id}` | Check asynchronous job progress | `200 OK` | `404`, `422` | Core (v1.0) |
| `POST /submissions/{id}/decision` | Accept or reject proposal with reviewer identity | `200 OK` | `404`, `409`, `422` | Core / Queue |
| `GET /catalog/datasets` | List catalog datasets with entry counts | `200 OK` | `422` | Catalog |
| `GET /catalog/datasets/{dataset_id}/entries` | List entries under a dataset | `200 OK` | `404`, `422` | Catalog |
| `GET /catalog/entries/{entry_id}` | Get full entry detail and schema columns | `200 OK` | `404` | Catalog |
| `GET /catalog/entries/{entry_id}/history` | Audit log of changes for an entry | `200 OK` | `404`, `422` | History |
| `GET /catalog/search` | Search datasets and column names | `200 OK` | `422` | Catalog |
| `GET /reports/submissions` | Export submission records for report generation | `200 OK` | `422` | Report |

---

## Core Business Rules & Behaviors

1. **Asynchronous Uploads (`POST /submissions`)**:
   - Accepts `multipart/form-data` containing a `file` (`.xls` or `.xlsx`) and an optional `sheet` name string.
   - Rejects files over 50 MB with `413 Payload Too Large` and non-Excel files with `415 Unsupported Media Type`.
   - Returns status code **`202 Accepted`** with a `Location` header pointing to `/jobs/{job_id}`.

2. **Pagination & Sorting (`GET /submissions`)**:
   - Query parameters: `page` (min `1`, default `1`), `page_size` (min `1`, max `100`, default `10`), `sort` (`uploaded_at` or `-uploaded_at`, default `-uploaded_at`)[cite: 2].
   - Date range filters: `uploaded_from` and `uploaded_to` (`YYYY-MM-DD`, inclusive UTC)[cite: 2].
   - Filters: `status` (`processing`, `draft`, `accepted`, `merged`, `rejected`) and `verdict` (`new_dataset`, `new_source`, `enrichment`, `duplicate`, `needs_review`)[cite: 2].
   - Returns `SubmissionPage` with item summaries including `matched_file_name` and `reason_short`[cite: 2].

3. **Decisions & Reviewer Identity (`POST /submissions/{id}/decision`)**:
   - Accepts `action` (`"accept"` or `"reject"`), optional manual `verdict`, optional `target_entry_id`, `note`, and `decided_by`[cite: 2].
   - **`decided_by` is self-declared and not authenticated.** Servers store it verbatim in `DecisionRecord` and `HistoryEvent`[cite: 2].
   - Accepting a `needs_review` proposal without specifying an explicit manual `verdict` returns **`409 Conflict`**.
   - Submitting a decision on an already processed (`accepted` or `merged`) submission returns **`409 Conflict`**.
   - Rejection (`"reject"`) sets status to `rejected` and leaves the catalog unchanged[cite: 2].

4. **Atomic Catalog Updates (Accept Operations)**:
   - `new_dataset`: Creates a new dataset and entry (`before = null`, `after = new_snapshot`)[cite: 2].
   - `new_source`: Creates a new entry under an existing matched dataset[cite: 2].
   - `enrichment`: Merges missing columns and years into the target entry[cite: 2].
   - `duplicate`: No schema change (`before == after`)[cite: 2].
   - Applied atomically inside a database transaction (`FOR UPDATE` locking)[cite: 2].

5. **Report Exports (`GET /reports/submissions`)**:
   - Supports filtering by status, verdict, date range, or explicit comma-separated `ids` (max 100)[cite: 2].
   - Hard cap at 1000 rows. Requests exceeding 1000 matching rows return **`422 Unprocessable Entity`** (`code: "report_too_large"`)[cite: 2].
   - Serves raw JSON structure; document/spreadsheet rendering (`.xlsx`, `.csv`) is handled client-side in the browser[cite: 2].