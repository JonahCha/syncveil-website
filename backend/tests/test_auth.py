from __future__ import annotations

from uuid import uuid4

from app.core.database import SessionLocal
from app import models


def _signup(client, email=None):
    email = email or f"alice-{uuid4().hex[:8]}@example.com"
    response = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": "SuperSecurePassword123!",
            "full_name": "Alice Example",
            "device_name": "Laptop",
            "device_fingerprint": "device-001",
        },
    )
    assert response.status_code == 200
    return response.json(), email


def test_signup_login_and_me(client):
    tokens, email = _signup(client)
    assert tokens["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_refresh_and_logout(client):
    tokens, _ = _signup(client, email=f"refresh-{uuid4().hex[:8]}@example.com")
    refresh = client.post(
        "/auth/refresh",
        json={"refresh_token": tokens["refresh_token"], "csrf_token": tokens["csrf_token"]},
        headers={"x-csrf-token": tokens["csrf_token"]},
    )
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]

    logout = client.post(
        "/auth/logout",
        json={"refresh_token": refresh.json()["refresh_token"], "csrf_token": refresh.json()["csrf_token"]},
        headers={"x-csrf-token": refresh.json()["csrf_token"]},
    )
    assert logout.status_code == 200


def test_password_reset_and_otp_flow(client, monkeypatch):
    _, email = _signup(client, email=f"recovery-{uuid4().hex[:8]}@example.com")
    forgot = client.post("/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200

    monkeypatch.setattr("secrets.randbelow", lambda _: 123456)
    otp_request = client.post("/auth/otp/request", json={"email": email})
    assert otp_request.status_code == 200

    otp_verify = client.post("/auth/otp/verify", json={"email": email, "code": "123456"})
    assert otp_verify.status_code == 200

    with SessionLocal() as db:
        row = db.query(models.RecoveryToken).filter_by(kind="otp").first()
        assert row is not None
        assert row.consumed_at is not None
