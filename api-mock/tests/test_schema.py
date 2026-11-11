import sqlite3
from pathlib import Path

import pytest


def test_postgresql_reference_schema_has_constraints_without_destructive_ddl():
    schema_file = Path(__file__).resolve().parents[2] / "db" / "schema.sql"
    schema = schema_file.read_text(encoding="utf-8").lower()
    assert "create extension if not exists vector" in schema
    assert "vector(1024)" in schema
    assert "references datasets(dataset_id)" in schema
    assert "references submissions(submission_id)" in schema
    assert "check (progress between 0 and 100)" in schema
    sql_statements = [
        line.strip()
        for line in schema.splitlines()
        if line.strip() and not line.lstrip().startswith("--")
    ]
    assert not any(line.startswith("drop table") for line in sql_statements)
    assert not any(line.startswith("truncate") for line in sql_statements)


def test_sqlite_store_enforces_foreign_keys_and_status_checks(api):
    _, store = api
    with pytest.raises(sqlite3.IntegrityError):
        with store._connection() as conn:
            conn.execute(
                """INSERT INTO entries
                   (entry_id, dataset_id, file_name, status, years_json, columns_json, updated_at)
                   VALUES ('ent_invalid', 'missing', 'file.xlsx', 'accepted', '[]', '[]', 'now')"""
            )
