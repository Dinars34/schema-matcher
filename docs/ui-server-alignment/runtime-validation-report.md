# Runtime Validation Report

**Generated**: 2026-11-11T12:15:37+07:00  
**Target**: `C:\Fernando\code\internship-project\schema-matcher`

## Summary

| Step | Status | Exit Code | Details |
|---|---|---:|---|
| Web build/type-check | PASS | 0 | `npm --prefix web run build` |
| Web lint | PASS | 0 | `npm --prefix web run lint` |
| Web unit tests | PASS | 0 | 2 test files, 6 tests |
| Mock API tests | PASS | 0 | 29 pytest tests, isolated in-memory SQLite |
| Contract smoke | PASS | 0 | Read-only `core`, `queue`, `catalog`, `history`, and `report` tiers against isolated SQLite mock |
| Startup | PASS | 0 | Playwright started Vite and FastAPI on dedicated ports; mock `/health` readiness passed |
| Browser E2E | PASS | 0 | 9 Playwright/Chromium tests covering upload, job/proposal, server-only progress, decisions/queue count, three-pane catalog/history, report download, capabilities, and unavailable-server states |
| PostgreSQL/pgvector integration | UNVERIFIED | N/A | Docker unavailable; no dedicated database connection configured. No developer database was accessed. |
| Real-server conformance | UNVERIFIED | N/A | No reachable real server or owner-confirmed contract was available. |

**Overall**: NEEDS_SIGNOFF — local mock and browser checks pass, but PostgreSQL/pgvector and real-server conformance are external validation gates.

## Environment and per-capability verdict

```yaml
environment:
  docker: UNAVAILABLE — Docker CLI/daemon was not available.
  node: AVAILABLE — v24.12.0.
  playwright: AVAILABLE — Chromium installation command exited 0; all browser tests passed.
  infra-tier: UNVERIFIED — isolated SQLite tests passed, but the planned PostgreSQL/pgvector tier was not available.
  browser-tier: PRIMARY(Playwright) — headless Chromium against the running Vite app and isolated FastAPI mock.
startup: PASS — Playwright webServer startup; FastAPI /health readiness returned successfully.
integration: PASS — exit_code: 0, passed: 29, failed: 0, skipped: 0; FastAPI TestClient with isolated in-memory SQLite; PostgreSQL SQL/locking/pgvector remain unverified.
contract: PASS — exit_code: 0, all five configured feature tiers passed against an isolated SQLite mock; real-server endpoint was unavailable.
e2e: PASS — exit_code: 0, passed: 9, failed: 0; upload-to-proposal, invalid upload, failed job, server-only progress, manual review/409, queue badge refresh, catalog navigation/history/empty state, report download, capability negotiation, and disconnected-server UI.
overall: NEEDS_SIGNOFF — local implementation is validated; real-server and PostgreSQL gates remain open.
```

## Legacy test migration

No legacy browser E2E suite was present. The Playwright suite was authored for
the new client/API journeys. The API pytest suite uses isolated in-memory
SQLite and does not connect to a developer database. Decision handling is
isolated in `api-mock/app/services/decisions.py`; transaction rollback tests
passed.

## Issues and remaining gates

| # | Severity | Description | Escalated To |
|---|---|---|---|
| 1 | External validation | PostgreSQL/pgvector DDL, transaction locking, and persistence have not been tested against a dedicated PostgreSQL database. | Project owner |
| 2 | External validation | Additive contract clarifications, status transitions, and capability support need confirmation against the real-server owner and reachable endpoint. | Real-server owner |

The mock intentionally does not implement embeddings, vector search, LLM
judgment, or real asynchronous processing. See [the implementation plan](./plan.md)
and [contract mismatch inventory](../../contract/MISMATCHES.md) for remaining
implementation and compatibility decisions.
