"""Read-only contract smoke checks; this script never uploads or decides."""

import argparse
import sys

import httpx


def run_smoke_test(base_url: str, feature_tier: str) -> None:
    required_features = {
        "core": set(),
        "queue": {"queue"},
        "catalog": {"catalog"},
        "history": {"history"},
        "report": {"report"},
    }[feature_tier]
    with httpx.Client(base_url=base_url.rstrip("/"), timeout=10.0) as client:
        health_response = client.get("/health")
        assert health_response.status_code == 200
        health = health_response.json()
        assert health.get("status") == "ok"
        assert health.get("contract_version") == "1.1.0"
        assert required_features.issubset(set(health.get("features", [])))

        page_response = client.get(
            "/submissions", params={"page": 1, "page_size": 5, "sort": "-uploaded_at"}
        )
        assert page_response.status_code == 200, page_response.text
        page = page_response.json()
        assert set(("items", "total", "page", "page_size")).issubset(page)
        assert page["page"] == 1 and page["page_size"] == 5
        assert isinstance(page["total"], int) and isinstance(page["items"], list)
        for item in page["items"]:
            assert {"id", "file_name", "uploaded_at", "status"}.issubset(item)

        filtered_response = client.get(
            "/submissions",
            params={"page": 1, "page_size": 5, "status": "draft"},
        )
        assert filtered_response.status_code == 200, filtered_response.text
        filtered = filtered_response.json()
        assert all(item["status"] == "draft" for item in filtered["items"])
        assert filtered["total"] <= page["total"]

        invalid_response = client.get("/submissions", params={"page": 0})
        assert invalid_response.status_code == 422
        assert {"code", "message", "details"}.issubset(invalid_response.json())

        if "catalog" in required_features:
            catalog_response = client.get(
                "/catalog/datasets", params={"page": 1, "page_size": 5}
            )
            assert catalog_response.status_code == 200, catalog_response.text
            catalog = catalog_response.json()
            assert {"items", "total", "page", "page_size"}.issubset(catalog)
            assert len(catalog["items"]) <= 5
            if "history" in required_features and catalog["items"]:
                dataset_id = catalog["items"][0]["dataset_id"]
                entries_response = client.get(
                    f"/catalog/datasets/{dataset_id}/entries",
                    params={"page": 1, "page_size": 1},
                )
                assert entries_response.status_code == 200
                entries = entries_response.json()["items"]
                if entries:
                    history_response = client.get(
                        f"/catalog/entries/{entries[0]['entry_id']}/history",
                        params={"page": 1, "page_size": 1},
                    )
                    assert history_response.status_code == 200
                    assert {"items", "total", "page", "page_size"}.issubset(
                        history_response.json()
                    )

        if "report" in required_features:
            report_response = client.get(
                "/reports/submissions",
                params={"status": "draft", "sort": "-uploaded_at"},
            )
            assert report_response.status_code == 200, report_response.text
            report = report_response.json()
            assert {"generated_at", "total", "rows"}.issubset(report)
            assert report["total"] == len(report["rows"])

    print(f"PASS: read-only v1.1.0 smoke checks against {base_url}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument(
        "--feature-tier",
        choices=("core", "queue", "catalog", "history", "report"),
        default="queue",
    )
    args = parser.parse_args()
    try:
        run_smoke_test(args.base_url, args.feature_tier)
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
