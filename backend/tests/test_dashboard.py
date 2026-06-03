from __future__ import annotations


def _auth(client):
    response = client.post(
        "/auth/signup",
        json={
            "email": "carol@example.com",
            "password": "SuperSecurePassword123!",
            "device_name": "Tablet",
            "device_fingerprint": "device-003",
        },
    )
    return response.json()["access_token"]


def test_dashboard_and_security_overview(client):
    token = _auth(client)
    dashboard = client.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert dashboard.status_code == 200
    assert "security_score" in dashboard.json()

    overview = client.get("/api/security/overview", headers={"Authorization": f"Bearer {token}"})
    assert overview.status_code == 200
    assert "recommendations" in overview.json()

