# Changelog

All notable changes to the Schema Matcher API contract will be documented in this file.

## [1.1.0] - 2026-11-10
### Added
- Feature flag negotiation on `GET /health` via `features` and `contract_version`[cite: 2].
- New submission filter and sorting parameters: `sort`, `uploaded_from`, `uploaded_to`[cite: 2].
- Item summary fields on list items: `matched_file_name` and `reason_short`[cite: 2].
- Reviewer identity support via optional `decided_by` field on decision payload and record[cite: 2].
- `rejected` status to `SubmissionStatus` enum[cite: 2].
- Catalog browser endpoints: `GET /catalog/datasets`, `GET /catalog/datasets/{dataset_id}/entries`, `GET /catalog/entries/{entry_id}`, and `GET /catalog/search`[cite: 2].
- Audit history endpoint: `GET /catalog/entries/{entry_id}/history`[cite: 2].
- Report data endpoint: `GET /reports/submissions` with 1000-row cap protection[cite: 2].

## [1.0.0] - 2026-03-30
### Added
- Initial release of the OpenAPI 3.1 contract.
- Endpoints implemented: `/health`, `/submissions` (GET/POST), `/submissions/{submission_id}`, `/submissions/{submission_id}/file`, `/jobs/{job_id}`, and `/submissions/{submission_id}/decision`.
- Uniform error handling schema (`ErrorResponse`) and paginated listing (`SubmissionPage`).