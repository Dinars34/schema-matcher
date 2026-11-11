from conftest import upload


def test_catalog_is_empty_before_any_decision(api):
    client, _ = api
    response = client.get("/catalog/datasets")
    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 10,
    }


def test_catalog_search_and_pagination_use_persisted_entries(api, xlsx_bytes):
    client, _ = api
    upload_response = upload(
        client, xlsx_bytes, headers={"X-Mock-Scenario": "new_dataset"}
    )
    submission_id = upload_response.json()["submission_id"]
    client.post(f"/submissions/{submission_id}/decision", json={"action": "accept"})

    datasets = client.get("/catalog/datasets?page=1&page_size=1").json()
    assert datasets["total"] == 1
    assert datasets["items"][0]["entry_count"] == 1

    entry_page = client.get(
        f"/catalog/datasets/{datasets['items'][0]['dataset_id']}/entries"
    ).json()
    assert entry_page["total"] == 1
    assert entry_page["items"][0]["file_name"] == "report.xlsx"

    search = client.get("/catalog/search?q=kabupaten").json()
    assert search["columns"][0]["column_name"] == "kabupaten"
    assert search["columns"][0]["entry_id"] == entry_page["items"][0]["entry_id"]


def test_missing_catalog_resources_return_uniform_not_found(api):
    client, _ = api
    response = client.get("/catalog/entries/does-not-exist")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert response.json()["details"] is None


def test_history_pages_preserve_successive_before_and_after_snapshots(api, xlsx_bytes):
    client, _ = api
    entry_id = None
    for _ in range(2):
        uploaded = upload(
            client, xlsx_bytes, headers={"X-Mock-Scenario": "duplicate"}
        ).json()
        proposal = client.get(f"/submissions/{uploaded['submission_id']}").json()
        entry_id = proposal["proposal"]["matched"]["entry_id"]
        response = client.post(
            f"/submissions/{uploaded['submission_id']}/decision",
            json={"action": "accept", "target_entry_id": entry_id},
        )
        assert response.status_code == 200

    first_page = client.get(
        f"/catalog/entries/{entry_id}/history?page=1&page_size=1"
    ).json()
    second_page = client.get(
        f"/catalog/entries/{entry_id}/history?page=2&page_size=1"
    ).json()
    assert first_page["total"] == 2
    assert first_page["page"] == 1 and len(first_page["items"]) == 1
    assert second_page["page"] == 2 and len(second_page["items"]) == 1
    assert first_page["items"][0]["before"] == first_page["items"][0]["after"]
    assert second_page["items"][0]["before"] == second_page["items"][0]["after"]
