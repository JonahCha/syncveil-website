from __future__ import annotations

from io import BytesIO


def _auth(client):
    from uuid import uuid4
    response = client.post(
        "/auth/signup",
        json={
            "email": f"bob-{uuid4().hex[:8]}@example.com",
            "password": "SuperSecurePassword123!",
            "device_name": "Desktop",
            "device_fingerprint": "device-002",
        },
    )
    return response.json()["access_token"]


def test_file_upload_analysis_and_privacy_guardian(client):
    token = _auth(client)
    payload = BytesIO(b"password=letmein\napi_key=sk_live_secret_value\nThis file contains sensitive data.")
    response = client.post(
        "/api/vault/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("secrets.txt", payload, "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] > 0
    assert data["sensitive_findings"]
    assert "sensitive-data" in data["tags"]
