from fastapi.testclient import TestClient

from qlogistics import service

BODY = {"options": [{"loadId": "L1", "truckId": "T1", "cost": 100}], "shots": 100}


def test_solve_requires_the_shared_key_when_one_is_set(monkeypatch):
    monkeypatch.setattr(service, "SERVICE_KEY", "s3cret")
    client = TestClient(service.app)
    assert client.post("/solve", json=BODY).status_code == 401
    assert client.post("/solve", json=BODY, headers={"X-Quantum-Key": "wrong"}).status_code == 401
    assert client.post("/solve", json=BODY, headers={"X-Quantum-Key": "s3cret"}).status_code == 200
    assert client.get("/health").status_code == 200  # health stays open for uptime checks
