# Changelog

All notable changes to the Schema Matcher API contract are documented here.

## [1.1.0] - 2026-11-10

### Added

- Health feature negotiation via `contract_version` and `features`.
- Submission sorting and date filters (`sort`, `uploaded_from`,
  `uploaded_to`) and summary fields `matched_file_name` and `reason_short`.
- Optional self-declared `decided_by` reviewer display value.
- `rejected` submission status.
- Catalog dataset, entry, search, and paginated history endpoints.
- JSON submissions report endpoint with a 1,000-row cap.

### Compatibility clarifications (not independently confirmed by the real-server owner)

- Published generated OpenAPI now includes documented decision fields
  (`verdict`, `target_entry_id`, `note`, `decided_by`) and the upload response
  body/Location behavior already emitted by the mock.
- Submission output includes the persisted `sha256` digest. Dataset summaries
  include `entry_count`, as already described by the endpoint overview.
- Mock decision status transitions follow the supplied workflow:
  `new_dataset`/`new_source` → `accepted`, `enrichment`/`duplicate` → `merged`,
  and reject → `rejected`.
- The mock has a test-only `X-Mock-Scenario` header, excluded from OpenAPI; it
  is not part of the v1.1.0 production contract.
- These clarifications are not claims of real-server support. See
  [MISMATCHES.md](MISMATCHES.md).

## [1.0.0] - 2026-03-30

### Added

- Initial OpenAPI 3.1 contract.
- `/health`, submission upload/list/detail/file, jobs, and decisions.
- Uniform `ErrorResponse` and paginated `SubmissionPage`.
