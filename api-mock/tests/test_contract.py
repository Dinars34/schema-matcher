def test_health_and_generated_openapi_are_v11(api):
    client, _ = api
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "version": "0.1.0",
        "contract_version": "1.1.0",
        "features": ["queue", "catalog", "history", "report"],
    }

    schema = client.get("/openapi.json").json()
    assert schema["info"]["version"] == "0.1.0"
    assert "/catalog/entries/{entry_id}/history" in schema["paths"]
    assert "verdict" in schema["components"]["schemas"]["DecisionRequest"]["properties"]
    assert schema["components"]["schemas"]["ErrorResponse"]["properties"].keys() == {
        "code",
        "message",
        "details",
    }


def test_query_validation_uses_uniform_error_response(api):
    client, _ = api
    response = client.get("/submissions?page=0")
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.json()["message"]
    assert isinstance(response.json()["details"], list)
