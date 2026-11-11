import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

from .fixtures import scenario_for
from .errors import StoreError
from .models import DecisionRequest
from .services.decisions import apply_decision


DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "mock.sqlite3"


class MockStore:
    """Durable SQLite reference store; it is not the PostgreSQL implementation."""

    def __init__(self, database_path: str | Path):
        self._uri = str(database_path) == ":memory:"
        self.database_path = (
            f"file:schema-matcher-{uuid.uuid4().hex}?mode=memory&cache=shared"
            if self._uri
            else str(database_path)
        )
        self._keeper = None
        if self._uri:
            self._keeper = sqlite3.connect(
                self.database_path, uri=True, check_same_thread=False
            )
        else:
            Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def _connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(self.database_path, timeout=10, uri=self._uri)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def close(self) -> None:
        if self._keeper is not None:
            self._keeper.close()
            self._keeper = None

    def _initialize(self) -> None:
        with self._connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS submissions (
                    id TEXT PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    sheet TEXT,
                    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
                    sha256 TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    verdict TEXT,
                    similarity REAL,
                    matched_file_name TEXT,
                    reason_short TEXT,
                    proposal_json TEXT,
                    decision_json TEXT,
                    file_bytes BLOB NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    submission_id TEXT NOT NULL REFERENCES submissions(id),
                    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
                    progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS datasets (
                    dataset_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE
                );
                CREATE TABLE IF NOT EXISTS entries (
                    entry_id TEXT PRIMARY KEY,
                    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
                    file_name TEXT NOT NULL,
                    source TEXT,
                    status TEXT NOT NULL CHECK (status IN ('draft', 'accepted', 'merged')),
                    years_json TEXT NOT NULL,
                    columns_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS decisions (
                    decision_id TEXT PRIMARY KEY,
                    submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id),
                    action TEXT NOT NULL CHECK (action IN ('accept', 'reject')),
                    verdict TEXT,
                    target_entry_id TEXT,
                    note TEXT,
                    decided_by TEXT,
                    decided_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS history (
                    event_id TEXT PRIMARY KEY,
                    entry_id TEXT NOT NULL REFERENCES entries(entry_id),
                    submission_id TEXT REFERENCES submissions(id),
                    action TEXT NOT NULL,
                    decided_by TEXT,
                    decided_at TEXT NOT NULL,
                    before_json TEXT,
                    after_json TEXT
                );
                CREATE INDEX IF NOT EXISTS submissions_uploaded_at_idx
                    ON submissions(uploaded_at DESC);
                CREATE INDEX IF NOT EXISTS submissions_status_verdict_idx
                    ON submissions(status, verdict);
                CREATE INDEX IF NOT EXISTS entries_dataset_idx ON entries(dataset_id);
                CREATE INDEX IF NOT EXISTS history_entry_time_idx
                    ON history(entry_id, decided_at DESC);
                """
            )

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

    def _seed_match_target(self, conn: sqlite3.Connection) -> sqlite3.Row:
        entry = conn.execute("SELECT * FROM entries ORDER BY entry_id LIMIT 1").fetchone()
        if entry:
            return entry
        dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
        entry_id = f"ent_{uuid.uuid4().hex[:12]}"
        now = self._now()
        conn.execute(
            "INSERT INTO datasets (dataset_id, name) VALUES (?, ?)",
            (dataset_id, "Mock fixture dataset"),
        )
        conn.execute(
            """INSERT INTO entries
               (entry_id, dataset_id, file_name, source, status, years_json, columns_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry_id,
                dataset_id,
                "fixture_existing.xlsx",
                "Mock fixture",
                "accepted",
                self._json([2023]),
                self._json([{"name": "jumlah", "data_type": "number"}]),
                now,
            ),
        )
        return conn.execute(
            "SELECT * FROM entries WHERE entry_id = ?", (entry_id,)
        ).fetchone()

    @staticmethod
    def _entry_ref(conn: sqlite3.Connection, entry: sqlite3.Row) -> dict[str, Any]:
        dataset = conn.execute(
            "SELECT name FROM datasets WHERE dataset_id = ?", (entry["dataset_id"],)
        ).fetchone()
        return {
            "entry_id": entry["entry_id"],
            "file_name": entry["file_name"],
            "dataset": dataset["name"],
            "source": entry["source"],
            "schema_card": {
                "columns": json.loads(entry["columns_json"]),
                "years": json.loads(entry["years_json"]),
            },
        }

    def create_submission(
        self,
        file_name: str,
        sheet: str | None,
        file_bytes: bytes,
        sha256: str,
        scenario_name: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        submission_id = f"sub_{uuid.uuid4().hex[:12]}"
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        uploaded_at = self._now()
        with self._connection() as conn:
            catalog_empty = conn.execute("SELECT 1 FROM datasets LIMIT 1").fetchone() is None
            scenario = scenario_for(
                scenario_name or ("new_dataset" if catalog_empty else "enrichment")
            )
            target = None
            if scenario["verdict"] in {"new_source", "enrichment", "duplicate", "needs_review"}:
                target = self._seed_match_target(conn)
            incoming = scenario["incoming"]
            matched = self._entry_ref(conn, target) if target else None
            proposal = {
                "verdict": scenario["verdict"],
                "similarity": scenario["similarity"],
                "reason": scenario["reason"],
                "incoming": incoming,
                "matched": matched,
            }
            status = "processing" if scenario["job_status"] == "failed" else "draft"
            conn.execute(
                """INSERT INTO submissions
                   (id, file_name, sheet, size_bytes, sha256, uploaded_at, status, verdict,
                    similarity, matched_file_name, reason_short, proposal_json, file_bytes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    submission_id,
                    file_name,
                    sheet,
                    len(file_bytes),
                    sha256,
                    uploaded_at,
                    status,
                    scenario["verdict"],
                    scenario["similarity"],
                    matched["file_name"] if matched else None,
                    scenario["reason"][:120],
                    self._json(proposal),
                    sqlite3.Binary(file_bytes),
                ),
            )
            conn.execute(
                """INSERT INTO jobs (job_id, submission_id, status, progress, message, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    job_id,
                    submission_id,
                    scenario["job_status"],
                    100 if scenario["job_status"] != "failed" else 100,
                    scenario["job_message"],
                    uploaded_at,
                ),
            )
        return {
            "job_id": job_id,
            "submission_id": submission_id,
            "file_name": file_name,
            "size_bytes": len(file_bytes),
            "sha256": sha256,
            "status": "processing",
        }, {"job_id": job_id, **scenario}

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self._connection() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
            if not row:
                return None
            return {
                "job_id": row["job_id"],
                "status": row["status"],
                "progress": row["progress"],
                "message": row["message"],
            }

    def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM submissions WHERE id = ?", (submission_id,)
            ).fetchone()
            return self._submission_dict(row) if row else None

    @staticmethod
    def _submission_dict(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "file_name": row["file_name"],
            "sheet": row["sheet"],
            "size_bytes": row["size_bytes"],
            "sha256": row["sha256"],
            "uploaded_at": row["uploaded_at"],
            "status": row["status"],
            "verdict": row["verdict"],
            "similarity": row["similarity"],
            "matched_file_name": row["matched_file_name"],
            "reason_short": row["reason_short"],
            "proposal": json.loads(row["proposal_json"]) if row["proposal_json"] else None,
            "decision": json.loads(row["decision_json"]) if row["decision_json"] else None,
        }

    def get_file(self, submission_id: str) -> tuple[bytes, str] | None:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT file_bytes, file_name FROM submissions WHERE id = ?",
                (submission_id,),
            ).fetchone()
            return (bytes(row["file_bytes"]), row["file_name"]) if row else None

    def list_submissions(
        self,
        page: int,
        page_size: int,
        status_filter: str | None,
        verdict_filter: str | None,
        uploaded_from: str | None,
        uploaded_to: str | None,
        sort: str,
    ) -> dict[str, Any]:
        where, values = self._submission_where(
            status_filter, verdict_filter, uploaded_from, uploaded_to
        )
        order = "ASC" if sort == "uploaded_at" else "DESC"
        with self._connection() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM submissions {where}", values
            ).fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM submissions {where} ORDER BY uploaded_at {order}, id ASC LIMIT ? OFFSET ?",
                values + [page_size, (page - 1) * page_size],
            ).fetchall()
            return {
                "items": [
                    {key: value for key, value in self._submission_dict(row).items()
                     if key not in {"proposal", "decision"}}
                    for row in rows
                ],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

    @staticmethod
    def _submission_where(
        status_filter: str | None,
        verdict_filter: str | None,
        uploaded_from: str | None,
        uploaded_to: str | None,
    ) -> tuple[str, list[Any]]:
        clauses = []
        values: list[Any] = []
        for column, value in (
            ("status", status_filter),
            ("verdict", verdict_filter),
        ):
            if value is not None:
                clauses.append(f"{column} = ?")
                values.append(value)
        if uploaded_from:
            clauses.append("date(uploaded_at) >= ?")
            values.append(uploaded_from)
        if uploaded_to:
            clauses.append("date(uploaded_at) <= ?")
            values.append(uploaded_to)
        return ("WHERE " + " AND ".join(clauses) if clauses else "", values)

    def decide(self, submission_id: str, decision: DecisionRequest) -> dict[str, Any]:
        return apply_decision(self, submission_id, decision)

    @staticmethod
    def _source_from_card() -> str | None:
        return None

    @staticmethod
    def _snapshot(entry: sqlite3.Row) -> dict[str, Any]:
        return {
            "source": entry["source"],
            "years": json.loads(entry["years_json"]),
            "columns": json.loads(entry["columns_json"]),
        }

    @staticmethod
    def _merge_columns(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
        merged = {column["name"].casefold(): column for column in existing}
        for column in incoming:
            merged.setdefault(column["name"].casefold(), column)
        return list(merged.values())

    def _insert_entry(
        self,
        conn: sqlite3.Connection,
        entry_id: str,
        dataset_id: str,
        file_name: str,
        snapshot: dict[str, Any],
        status: str,
    ) -> None:
        conn.execute(
            """INSERT INTO entries
               (entry_id, dataset_id, file_name, source, status, years_json, columns_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry_id,
                dataset_id,
                file_name,
                snapshot["source"],
                status,
                self._json(sorted(set(snapshot["years"]))),
                self._json(snapshot["columns"]),
                self._now(),
            ),
        )

    def list_datasets(self, q: str | None, page: int, page_size: int) -> dict[str, Any]:
        pattern = f"%{q.casefold()}%" if q else None
        where = "WHERE LOWER(d.name) LIKE ?" if pattern else ""
        params = [pattern] if pattern else []
        with self._connection() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM datasets d {where}", params
            ).fetchone()[0]
            rows = conn.execute(
                f"""SELECT d.dataset_id, d.name, COUNT(e.entry_id) AS entry_count
                    FROM datasets d LEFT JOIN entries e ON e.dataset_id = d.dataset_id
                    {where} GROUP BY d.dataset_id ORDER BY LOWER(d.name), d.dataset_id
                    LIMIT ? OFFSET ?""",
                params + [page_size, (page - 1) * page_size],
            ).fetchall()
            return {
                "items": [dict(row) for row in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

    def list_entries(self, dataset_id: str, page: int, page_size: int) -> dict[str, Any] | None:
        with self._connection() as conn:
            if not conn.execute(
                "SELECT 1 FROM datasets WHERE dataset_id = ?", (dataset_id,)
            ).fetchone():
                return None
            total = conn.execute(
                "SELECT COUNT(*) FROM entries WHERE dataset_id = ?", (dataset_id,)
            ).fetchone()[0]
            rows = conn.execute(
                """SELECT * FROM entries WHERE dataset_id = ?
                   ORDER BY updated_at DESC, entry_id LIMIT ? OFFSET ?""",
                (dataset_id, page_size, (page - 1) * page_size),
            ).fetchall()
            return {
                "items": [self._entry_summary(row) for row in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

    @staticmethod
    def _entry_summary(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "entry_id": row["entry_id"],
            "dataset_id": row["dataset_id"],
            "file_name": row["file_name"],
            "source": row["source"],
            "status": row["status"],
            "years": json.loads(row["years_json"]),
            "updated_at": row["updated_at"],
        }

    def get_entry(self, entry_id: str) -> dict[str, Any] | None:
        with self._connection() as conn:
            row = conn.execute(
                """SELECT e.*, d.name AS dataset_name FROM entries e
                   JOIN datasets d ON d.dataset_id = e.dataset_id WHERE e.entry_id = ?""",
                (entry_id,),
            ).fetchone()
            if not row:
                return None
            return {
                **self._entry_summary(row),
                "dataset_name": row["dataset_name"],
                "columns": json.loads(row["columns_json"]),
            }

    def get_history(self, entry_id: str, page: int, page_size: int) -> dict[str, Any] | None:
        with self._connection() as conn:
            if not conn.execute(
                "SELECT 1 FROM entries WHERE entry_id = ?", (entry_id,)
            ).fetchone():
                return None
            total = conn.execute(
                "SELECT COUNT(*) FROM history WHERE entry_id = ?", (entry_id,)
            ).fetchone()[0]
            rows = conn.execute(
                """SELECT * FROM history WHERE entry_id = ?
                   ORDER BY decided_at DESC, event_id LIMIT ? OFFSET ?""",
                (entry_id, page_size, (page - 1) * page_size),
            ).fetchall()
            items = [
                {
                    "event_id": row["event_id"],
                    "entry_id": row["entry_id"],
                    "submission_id": row["submission_id"],
                    "action": row["action"],
                    "decided_by": row["decided_by"],
                    "decided_at": row["decided_at"],
                    "before": json.loads(row["before_json"]) if row["before_json"] else None,
                    "after": json.loads(row["after_json"]) if row["after_json"] else None,
                }
                for row in rows
            ]
            return {"items": items, "total": total, "page": page, "page_size": page_size}

    def search_catalog(self, q: str) -> dict[str, Any]:
        needle = q.casefold()
        with self._connection() as conn:
            datasets = conn.execute(
                """SELECT d.dataset_id, d.name, COUNT(e.entry_id) AS entry_count
                   FROM datasets d LEFT JOIN entries e ON e.dataset_id = d.dataset_id
                   WHERE LOWER(d.name) LIKE ? GROUP BY d.dataset_id ORDER BY LOWER(d.name)""",
                (f"%{needle}%",),
            ).fetchall()
            columns = conn.execute(
                """SELECT json_extract(c.value, '$.name') AS column_name,
                          e.entry_id, e.dataset_id, e.file_name
                   FROM entries e, json_each(e.columns_json) c
                   WHERE LOWER(json_extract(c.value, '$.name')) LIKE ?
                   ORDER BY LOWER(e.file_name), LOWER(json_extract(c.value, '$.name'))""",
                (f"%{needle}%",),
            ).fetchall()
            return {
                "datasets": [dict(row) for row in datasets],
                "columns": [dict(row) for row in columns],
            }

    def report(
        self,
        status_filter: str | None,
        verdict_filter: str | None,
        uploaded_from: str | None,
        uploaded_to: str | None,
        ids: list[str] | None,
        sort: str,
    ) -> dict[str, Any]:
        if ids is not None and len(ids) > 100:
            raise StoreError(422, "validation_error", "Maksimal 100 submission ID.")
        where, values = self._submission_where(
            status_filter, verdict_filter, uploaded_from, uploaded_to
        )
        if ids:
            clause = "id IN (" + ",".join("?" for _ in ids) + ")"
            where += (" AND " if where else "WHERE ") + clause
            values.extend(ids)
        order = "ASC" if sort == "uploaded_at" else "DESC"
        with self._connection() as conn:
            count = conn.execute(f"SELECT COUNT(*) FROM submissions {where}", values).fetchone()[0]
            if count > 1000:
                raise StoreError(422, "report_too_large", "Laporan melebihi batas 1000 baris.")
            rows = conn.execute(
                f"""SELECT id, file_name, sheet, size_bytes, sha256, uploaded_at, status,
                           verdict, similarity, matched_file_name, reason_short
                    FROM submissions {where} ORDER BY uploaded_at {order}, id ASC""",
                values,
            ).fetchall()
            return {
                "generated_at": self._now(),
                "total": count,
                "rows": [dict(row) for row in rows],
            }


_store: MockStore | None = None


def get_store() -> MockStore:
    global _store
    if _store is None:
        configured_path = os.environ.get("SCHEMA_MATCHER_MOCK_DB")
        _store = MockStore(configured_path or DEFAULT_DB_PATH)
    return _store
