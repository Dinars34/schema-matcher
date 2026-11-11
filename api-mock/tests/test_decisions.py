import pytest

from conftest import upload


def post_decision(client, submission_id, payload):
    return client.post(f"/submissions/{submission_id}/decision", json=payload)


def test_needs_review_requires_manual_verdict_then_enriches_atomically(api, xlsx_bytes):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "needs_review"}
    )
    submission_id = upload_response.json()["submission_id"]
    detail = client.get(f"/submissions/{submission_id}").json()
    target_entry_id = detail["proposal"]["matched"]["entry_id"]

    missing_verdict = post_decision(
        client, submission_id, {"action": "accept", "decided_by": "Reviewer"}
    )
    assert missing_verdict.status_code == 409
    assert missing_verdict.json()["code"] == "conflict"

    accepted = post_decision(
        client,
        submission_id,
        {
            "action": "accept",
            "verdict": "enrichment",
            "target_entry_id": target_entry_id,
            "decided_by": "Reviewer",
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "merged"
    entry = client.get(f"/catalog/entries/{target_entry_id}").json()
    assert entry["years"] == [2023, 2024]
    history = client.get(f"/catalog/entries/{target_entry_id}/history").json()
    assert history["total"] == 1
    assert history["items"][0]["decided_by"] == "Reviewer"
    assert history["items"][0]["before"]["years"] == [2023]
    assert history["items"][0]["after"]["years"] == [2023, 2024]

    duplicate_decision = post_decision(
        client, submission_id, {"action": "reject"}
    )
    assert duplicate_decision.status_code == 409


def test_target_entry_is_required_when_verdict_requires_a_match(api, xlsx_bytes):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "new_dataset"}
    )
    submission_id = upload_response.json()["submission_id"]

    response = post_decision(
        client,
        submission_id,
        {"action": "accept", "verdict": "new_source"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert client.get("/catalog/datasets").json()["total"] == 0


def test_rejection_does_not_change_catalog(api, xlsx_bytes):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "enrichment"}
    )
    submission_id = upload_response.json()["submission_id"]
    before_catalog = client.get("/catalog/datasets").json()

    rejected = post_decision(
        client, submission_id, {"action": "reject", "note": "Not a match"}
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert client.get("/catalog/datasets").json() == before_catalog


def test_duplicate_decision_records_equal_snapshot_without_catalog_mutation(api, xlsx_bytes):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "duplicate"}
    )
    submission_id = upload_response.json()["submission_id"]
    proposal = client.get(f"/submissions/{submission_id}").json()["proposal"]
    entry_id = proposal["matched"]["entry_id"]
    entry_before = client.get(f"/catalog/entries/{entry_id}").json()

    response = post_decision(
        client, submission_id, {"action": "accept", "target_entry_id": entry_id}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "merged"
    entry_after = client.get(f"/catalog/entries/{entry_id}").json()
    assert entry_after == entry_before
    history = client.get(f"/catalog/entries/{entry_id}/history").json()
    assert history["items"][0]["before"] == history["items"][0]["after"]


def test_mid_decision_failure_rolls_back_every_write(api, xlsx_bytes, monkeypatch):
    client, store = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "new_dataset"}
    )
    submission_id = upload_response.json()["submission_id"]

    def fail_insert(*args, **kwargs):
        raise RuntimeError("forced test failure")

    monkeypatch.setattr(store, "_insert_entry", fail_insert)
    response = post_decision(client, submission_id, {"action": "accept"})
    assert response.status_code == 500
    assert store.list_datasets(None, 1, 10)["total"] == 0
    submission = store.get_submission(submission_id)
    assert submission["status"] == "draft"
    assert submission["decision"] is None


@pytest.mark.parametrize(
    ("scenario", "expected_status"),
    [
        ("new_dataset", "accepted"),
        ("new_source", "accepted"),
        ("enrichment", "merged"),
        ("duplicate", "merged"),
    ],
)
def test_each_automatic_verdict_has_expected_final_status(
    api, xlsx_bytes, scenario, expected_status
):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": scenario}
    )
    submission_id = upload_response.json()["submission_id"]
    response = post_decision(client, submission_id, {"action": "accept"})
    assert response.status_code == 200
    assert response.json()["status"] == expected_status
    if scenario == "new_dataset":
        assert client.get("/catalog/datasets").json()["total"] == 1
    if scenario == "new_source":
        datasets = client.get("/catalog/datasets").json()["items"]
        assert len(datasets) == 1
        assert datasets[0]["entry_count"] == 2
