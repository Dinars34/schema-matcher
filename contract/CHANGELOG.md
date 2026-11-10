# Changelog

All notable changes to the Schema Matcher API contract will be documented in this file.

## [1.0.0] - 2026-03-30
### Added
- Initial release of the OpenAPI 3.1 contract.
- Endpoints implemented: `/health`, `/submissions` (GET/POST), `/submissions/{submission_id}`, `/submissions/{submission_id}/file`, `/jobs/{job_id}`, and `/submissions/{submission_id}/decision`.
- Uniform error handling schema (`ErrorResponse`) and paginated listing (`SubmissionPage`).