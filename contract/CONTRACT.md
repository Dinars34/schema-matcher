# Schema Matcher API Contract (v1.0.0)

This document defines the interface and business rules for the Schema Matcher backend service.

## Base URL
- Development / Mock: `http://127.0.0.1:8000`

---

## Endpoints Overview

| Method & Path | Summary | Success Status | Error Responses |
|---|---|---|---|
| `GET /health` | Check system health | `200 OK` | - |
| `GET /submissions` | List submissions with filters & pagination | `200 OK` | `422` |
| `POST /submissions` | Upload raw Excel file (multipart) | `202 Accepted` | `400`, `413`, `415`, `422` |
| `GET /submissions/{id}` | Get submission detail & proposal | `200 OK` | `422` |
| `GET /submissions/{id}/file` | Download original binary file | `200 OK` | `422` |
| `GET /jobs/{job_id}` | Check asynchronous job progress | `200 OK` | `422` |
| `POST /submissions/{id}/decision` | Accept or reject matching proposal | `200 OK` | `422` |

---

## Core Business Rules & Behaviors

1. **Asynchronous Uploads (`POST /submissions`)**:
   - Accepts `multipart/form-data` containing a `file` (Excel binary) and an optional `sheet` name string.
   - Returns status code **`202 Accepted`** with a `Location` header pointing to the job status route.
   - Calculates a cryptographic SHA-256 hash of the uploaded bytes.

2. **Job Progression (`GET /jobs/{job_id}`)**:
   - Jobs are computed dynamically based on time elapsed since submission creation.
   - Status transitions from `"processing"` (with increasing `progress` percentage) to `"completed"` once processing finishes.

3. **Pagination & Filtering (`GET /submissions`)**:
   - Supports query parameters `page` (default `1`, min `1`) and `page_size` (default `10`, max `100`).
   - Supports optional filters: `status` (`processing`, `draft`, `accepted`, `merged`) and `verdict` (`new_dataset`, `new_source`, `enrichment`, `duplicate`, `needs_review`).
   - Returns a `SubmissionPage` object containing `items`, `total`, `page`, and `page_size`.

4. **Uniform Error Structure**:
   - All error responses conform strictly to the `ErrorResponse` model, containing a machine-readable `code`, a descriptive `message`, and optional `details`.