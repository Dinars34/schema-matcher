import sys
import httpx

BASE_URL = "http://127.0.0.1:8000"


def run_smoke_test():
    print(f"Starting complete API smoke test against {BASE_URL}...\n")

    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # -------------------------------------------------------------
        # 1. Test GET /health
        # -------------------------------------------------------------
        print("-> Testing GET /health")
        res = client.get("/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        assert res.json()["status"] == "ok"
        print("   [PASS] GET /health -> Status 200 OK")

        # -------------------------------------------------------------
        # 2. Test POST /submissions (Multipart Upload)
        # -------------------------------------------------------------
        print("\n-> Testing POST /submissions (Upload)[cite: 4]")
        # Create dummy Excel binary payload
        dummy_file_bytes = b"PK\x03\x04mock_excel_binary_content_for_testing"
        files = {
            "file": (
                "smoke_test_data.xlsx",
                dummy_file_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        data = {"sheet": "Sheet1"}

        res = client.post("/submissions", files=files, data=data)
        assert res.status_code == 202, f"Create submission failed: {res.text}"

        sub_res = res.json()
        job_id = sub_res.get("job_id")
        submission_id = sub_res.get("submission_id")
        assert job_id and sub_res.get("sha256"), "Missing job_id or sha256 in response"
        print(f"   [PASS] POST /submissions -> Status 202 Accepted")
        print(f"          Created Submission ID: {submission_id}")
        print(f"          Created Job ID: {job_id}")

        # -------------------------------------------------------------
        # 3. Test GET /jobs/{job_id}
        # -------------------------------------------------------------
        print(f"\n-> Testing GET /jobs/{job_id}[cite: 4]")
        res = client.get(f"/jobs/{job_id}")
        assert res.status_code == 200, f"Get job status failed: {res.text}"
        job_data = res.json()
        assert "status" in job_data and "progress" in job_data
        print(
            f"   [PASS] GET /jobs/{job_id} -> Status 200 OK (State: {job_data['status']}, Progress: {job_data['progress']}%)"
        )

        # -------------------------------------------------------------
        # 4. Test GET /submissions (List with Pagination)
        # -------------------------------------------------------------
        print("\n-> Testing GET /submissions (List)[cite: 4]")
        res = client.get("/submissions?page=1&page_size=10")
        assert res.status_code == 200, f"List submissions failed: {res.text}"
        page_data = res.json()
        assert "items" in page_data and "total" in page_data
        assert page_data["total"] >= 1, "Expected at least 1 submission in the database"
        print(
            f"   [PASS] GET /submissions -> Status 200 OK (Total items found: {page_data['total']})"
        )

        # -------------------------------------------------------------
        # 5. Test GET /submissions/{submission_id} (Detail)
        # -------------------------------------------------------------
        print(f"\n-> Testing GET /submissions/{submission_id}[cite: 4]")
        res = client.get(f"/submissions/{submission_id}")
        assert res.status_code == 200, f"Get submission detail failed: {res.text}"
        detail_data = res.json()
        assert detail_data["id"] == submission_id
        print(f"   [PASS] GET /submissions/{submission_id} -> Status 200 OK")

        # -------------------------------------------------------------
        # 6. Test POST /submissions/{submission_id}/decision
        # -------------------------------------------------------------
        print(f"\n-> Testing POST /submissions/{submission_id}/decision[cite: 4]")
        decision_payload = {"action": "accept", "note": "Automated smoke test approval"}
        res = client.post(
            f"/submissions/{submission_id}/decision", json=decision_payload
        )
        assert res.status_code == 200, f"Decision submission failed: {res.text}"
        decision_data = res.json()
        assert decision_data["status"] == "accepted"
        print(
            f"   [PASS] POST /submissions/{submission_id}/decision -> Status 200 OK (Updated status: accepted)"
        )

        # -------------------------------------------------------------
        # 7. Test GET /submissions/{submission_id}/file (Byte Download)
        # -------------------------------------------------------------
        print(f"\n-> Testing GET /submissions/{submission_id}/file[cite: 4]")
        res = client.get(f"/submissions/{submission_id}/file")
        assert res.status_code == 200, f"File download failed: {res.text}"
        assert res.content == dummy_file_bytes, (
            "Downloaded file bytes do not match uploaded content!"
        )
        print(
            "   [PASS] GET /submissions/{submission_id}/file -> Status 200 OK (Byte-identical round-trip verified)"
        )

    print("\n==================================================")
    print(" SUCCESS: All endpoints successfully tested & verified!")
    print("==================================================")


if __name__ == "__main__":
    try:
        run_smoke_test()
    except Exception as e:
        print(f"\n[X] SMOKE TEST FAILURE: {e}", file=sys.stderr)
        sys.exit(1)
