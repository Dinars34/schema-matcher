import pytest

from conftest import upload


@pytest.mark.parametrize(
    ("scenario", "job_status", "verdict"),
    [
        ("new_dataset", "completed", "new_dataset"),
        ("new_source", "completed", "new_source"),
        ("enrichment", "completed", "enrichment"),
        ("duplicate", "completed", "duplicate"),
        ("needs_review", "completed", "needs_review"),
        ("failed_job", "failed", "new_dataset"),
    ],
)
def test_scenario_and_job_results_are_persisted(api, xlsx_bytes, scenario, job_status, verdict):
    client, store = api
    response = upload(
        client,
        xlsx_bytes,
        headers={"X-Mock-Scenario": scenario},
    )
    assert response.status_code == 202
    upload_body = response.json()
    job = client.get(f"/jobs/{upload_body['job_id']}").json()
    assert job["status"] == job_status
    assert job["progress"] == 100

    submission = client.get(f"/submissions/{upload_body['submission_id']}").json()
    assert submission["proposal"]["verdict"] == verdict
    assert store.get_job(upload_body["job_id"]) == job
