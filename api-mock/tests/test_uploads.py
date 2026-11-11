import hashlib
import io
import zipfile

from conftest import upload
from app import main


def test_upload_persists_original_bytes_and_returns_job_location(api, xlsx_bytes):
    client, store = api
    response = upload(
        client,
        xlsx_bytes,
        r"..\private\report.xlsx",
        {"X-Mock-Scenario": "new_dataset"},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["file_name"] == "report.xlsx"
    assert body["sha256"] == hashlib.sha256(xlsx_bytes).hexdigest()
    assert response.headers["location"] == f"/jobs/{body['job_id']}"
    assert client.get(response.headers["location"]).json()["status"] == "completed"
    file_response = client.get(f"/submissions/{body['submission_id']}/file")
    assert file_response.content == xlsx_bytes

    persisted = store.get_submission(body["submission_id"])
    assert persisted["sha256"] == body["sha256"]
    assert persisted["proposal"]["verdict"] == "new_dataset"


def test_rejects_non_workbooks_and_unknown_scenario_without_persisting(api, xlsx_bytes):
    client, _ = api
    invalid = upload(client, b"not an excel workbook")
    assert invalid.status_code == 415
    assert invalid.json()["code"] == "unsupported_media_type"

    valid_zip_but_wrong_extension = upload(
        client,
        b"PK\x03\x04not an xlsx",
        name="data.xlsx",
    )
    assert valid_zip_but_wrong_extension.status_code == 415

    malformed_workbook = io.BytesIO()
    with zipfile.ZipFile(malformed_workbook, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Override PartName="/xl/workbook.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            "</Types>",
        )
        archive.writestr("xl/workbook.xml", "<not-a-workbook/>")
        archive.writestr("xl/_rels/workbook.xml.rels", "<Relationships/>")
    malformed = upload(client, malformed_workbook.getvalue())
    assert malformed.status_code == 415

    unknown_scenario = upload(
        client,
        xlsx_bytes,
        headers={"X-Mock-Scenario": "unknown"},
    )
    assert unknown_scenario.status_code == 422


def test_upload_enforces_size_limit_before_parsing(api, xlsx_bytes, monkeypatch):
    client, _ = api
    monkeypatch.setattr(main, "MAX_FILE_SIZE", len(xlsx_bytes) - 1)
    response = upload(client, xlsx_bytes)
    assert response.status_code == 413
    assert response.json()["code"] == "payload_too_large"


def test_upload_limit_is_50_mib():
    assert main.MAX_FILE_SIZE == 50 * 1024 * 1024
