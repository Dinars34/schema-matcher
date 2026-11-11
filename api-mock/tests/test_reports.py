import sqlite3
from datetime import datetime, timezone

from conftest import upload


def test_report_json_filters_and_id_limit(api, xlsx_bytes):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "new_dataset"}
    )
    submission_id = upload_response.json()["submission_id"]

    report = client.get(
        f"/reports/submissions?status=draft&verdict=new_dataset&ids={submission_id}"
    )
    assert report.status_code == 200
    assert report.json()["total"] == 1
    assert report.json()["rows"][0]["id"] == submission_id

    too_many_ids = ",".join(f"sub_{index}" for index in range(101))
    error = client.get(f"/reports/submissions?ids={too_many_ids}")
    assert error.status_code == 422
    assert error.json()["code"] == "validation_error"


def test_report_enforces_1000_row_cap_without_external_database(api):
    client, store = api
    with store._connection() as conn:
        uploaded_at = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            """INSERT INTO submissions
               (id, file_name, size_bytes, sha256, uploaded_at, status, file_bytes)
               VALUES (?, ?, 0, ?, ?, 'draft', ?)""",
            [
                (f"sub_report_{index}", "report.xlsx", "a" * 64, uploaded_at, sqlite3.Binary(b""))
                for index in range(1001)
            ],
        )
    response = client.get("/reports/submissions")
    assert response.status_code == 422
    assert response.json()["code"] == "report_too_large"
