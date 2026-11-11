import json
import sqlite3
import uuid
from contextlib import AbstractContextManager
from typing import Any, Protocol

from ..errors import StoreError
from ..models import DecisionRequest


class DecisionStore(Protocol):
    def _connection(self) -> AbstractContextManager[sqlite3.Connection]: ...

    def _now(self) -> str: ...

    def _json(self, value: Any) -> str: ...

    def _source_from_card(self) -> str | None: ...

    def _snapshot(self, entry: sqlite3.Row) -> dict[str, Any]: ...

    def _merge_columns(
        self, existing: list[dict[str, Any]], incoming: list[dict[str, Any]]
    ) -> list[dict[str, Any]]: ...

    def _insert_entry(
        self,
        conn: sqlite3.Connection,
        entry_id: str,
        dataset_id: str,
        file_name: str,
        snapshot: dict[str, Any],
        status: str,
    ) -> None: ...


def apply_decision(
    store: DecisionStore, submission_id: str, decision: DecisionRequest
) -> dict[str, Any]:
    with store._connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM submissions WHERE id = ?", (submission_id,)
        ).fetchone()
        if row is None:
            raise StoreError(404, "not_found", "Submission not found")
        if row["status"] in {"accepted", "merged", "rejected"} or row["decision_json"]:
            raise StoreError(409, "conflict", "Submission sudah diproses.")
        proposal = json.loads(row["proposal_json"] or "{}")
        verdict = decision.verdict or proposal.get("verdict")
        if decision.action == "accept":
            if proposal.get("verdict") == "needs_review" and decision.verdict is None:
                raise StoreError(
                    409,
                    "conflict",
                    "Pilih verdict manual sebelum menerima proposal needs_review.",
                )
            if verdict == "needs_review":
                raise StoreError(422, "validation_error", "Verdict manual tidak valid.")
            final_verdict = verdict
        else:
            final_verdict = proposal.get("verdict")
        target_entry_id = decision.target_entry_id
        if (
            decision.action == "accept"
            and verdict in {"new_source", "enrichment", "duplicate"}
            and not target_entry_id
        ):
            target_entry_id = (proposal.get("matched") or {}).get("entry_id")
        if (
            decision.action == "accept"
            and verdict in {"new_source", "enrichment", "duplicate"}
            and not target_entry_id
        ):
            raise StoreError(422, "validation_error", "Target entry wajib diisi.")

        decided_at = store._now()
        decision_data = {
            "action": decision.action,
            "verdict": final_verdict,
            "target_entry_id": target_entry_id,
            "note": decision.note,
            "decided_by": decision.decided_by,
            "decided_at": decided_at,
        }
        entry_id: str | None = None
        before: dict[str, Any] | None = None
        after: dict[str, Any] | None = None
        new_status = "rejected" if decision.action == "reject" else (
            "accepted" if final_verdict in {"new_dataset", "new_source"} else "merged"
        )

        if decision.action == "accept":
            incoming = proposal["incoming"]
            if final_verdict == "new_dataset":
                dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
                entry_id = f"ent_{uuid.uuid4().hex[:12]}"
                dataset_name = f"Dataset {row['file_name']}"
                conn.execute(
                    "INSERT INTO datasets (dataset_id, name) VALUES (?, ?)",
                    (dataset_id, dataset_name),
                )
                after = {
                    "source": store._source_from_card(),
                    "years": incoming["years"],
                    "columns": [column for column in incoming["columns"]],
                }
                store._insert_entry(
                    conn, entry_id, dataset_id, row["file_name"], after, "accepted"
                )
            else:
                entry_id = target_entry_id
                target = conn.execute(
                    "SELECT * FROM entries WHERE entry_id = ?", (entry_id,)
                ).fetchone()
                if target is None:
                    raise StoreError(404, "not_found", "Target entry not found")
                before = store._snapshot(target)
                after = before
                if final_verdict == "new_source":
                    new_entry_id = f"ent_{uuid.uuid4().hex[:12]}"
                    after = {
                        "source": store._source_from_card(),
                        "years": incoming["years"],
                        "columns": incoming["columns"],
                    }
                    store._insert_entry(
                        conn,
                        new_entry_id,
                        target["dataset_id"],
                        row["file_name"],
                        after,
                        "accepted",
                    )
                    entry_id = new_entry_id
                    before = None
                elif final_verdict == "enrichment":
                    after = {
                        "source": target["source"],
                        "years": sorted(set(before["years"]) | set(incoming["years"])),
                        "columns": store._merge_columns(
                            before["columns"], incoming["columns"]
                        ),
                    }
                    conn.execute(
                        """UPDATE entries SET years_json = ?, columns_json = ?, status = 'merged',
                           updated_at = ? WHERE entry_id = ?""",
                        (
                            store._json(after["years"]),
                            store._json(after["columns"]),
                            decided_at,
                            entry_id,
                        ),
                    )
                elif final_verdict != "duplicate":
                    raise StoreError(422, "validation_error", "Verdict tidak didukung.")
            conn.execute(
                """INSERT INTO history
                   (event_id, entry_id, submission_id, action, decided_by, decided_at, before_json, after_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"evt_{uuid.uuid4().hex[:12]}",
                    entry_id,
                    submission_id,
                    final_verdict,
                    decision.decided_by,
                    decided_at,
                    store._json(before) if before is not None else None,
                    store._json(after) if after is not None else None,
                ),
            )
        conn.execute(
            """INSERT INTO decisions
               (decision_id, submission_id, action, verdict, target_entry_id, note, decided_by, decided_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"dec_{uuid.uuid4().hex[:12]}",
                submission_id,
                decision.action,
                final_verdict,
                entry_id or target_entry_id,
                decision.note,
                decision.decided_by,
                decided_at,
            ),
        )
        decision_data["target_entry_id"] = entry_id or target_entry_id
        conn.execute(
            "UPDATE submissions SET status = ?, verdict = ?, decision_json = ? WHERE id = ?",
            (new_status, final_verdict, store._json(decision_data), submission_id),
        )

    return {
        "submission_id": submission_id,
        "status": new_status,
        "action_taken": decision.action,
        "note": decision.note,
    }
