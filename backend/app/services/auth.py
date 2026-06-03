from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.config import get_settings
from app.core.security import (
    build_csrf_token,
    decrypt_bytes,
    generate_token,
    encrypt_bytes,
    is_expired,
    hash_password,
    hash_token,
    sign_jwt,
    utcnow,
    verify_password,
    verify_totp,
)
from app.services.audit import audit_log
from app.services.security import login_anomaly_risk, score_user

settings = get_settings()


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.scalar(select(models.User).where(models.User.email == email.lower()))


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return db.get(models.User, user_id)


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str | None = None,
    oauth_provider: str | None = None,
    oauth_subject: str | None = None,
) -> models.User:
    user = models.User(
        email=email.lower(),
        full_name=full_name,
        password_hash=hash_password(password),
        email_verified=not settings.email_verification_required,
        oauth_provider=oauth_provider,
        oauth_subject=oauth_subject,
        password_changed_at=utcnow(),
    )
    db.add(user)
    db.flush()
    score_user(db, user)
    return user


def _device_fingerprint(value: str | None, user_agent: str | None) -> str:
    return value or (user_agent or "unknown-device")


def create_or_update_device(
    db: Session,
    *,
    user: models.User,
    fingerprint: str | None,
    device_name: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> models.UserDevice:
    device_fingerprint = _device_fingerprint(fingerprint, user_agent)
    device = db.scalar(
        select(models.UserDevice).where(
            models.UserDevice.user_id == user.id,
            models.UserDevice.fingerprint == device_fingerprint,
        )
    )
    if device is None:
        device = models.UserDevice(
            user_id=user.id,
            fingerprint=device_fingerprint,
            name=device_name or "Unknown device",
            ip_address=ip_address,
            user_agent=user_agent,
            trust_level="untrusted",
            risk_score=55,
            first_seen_at=utcnow(),
            last_seen_at=utcnow(),
        )
        db.add(device)
        db.flush()
        audit_log(
            db,
            actor_user_id=user.id,
            action="device.registered",
            resource_type="device",
            resource_id=str(device.id),
            ip_address=ip_address,
            device_id=device.id,
            metadata={"name": device.name},
        )
    else:
        device.ip_address = ip_address or device.ip_address
        device.user_agent = user_agent or device.user_agent
        device.name = device_name or device.name
        device.last_seen_at = utcnow()
    return device


def issue_session(
    db: Session,
    *,
    user: models.User,
    device: models.UserDevice | None,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, str, str, models.RefreshSession]:
    refresh_token = generate_token(48)
    csrf_token = build_csrf_token()
    session = models.RefreshSession(
        user_id=user.id,
        device_id=device.id if device else None,
        token_hash=hash_token(refresh_token),
        csrf_token=csrf_token,
        expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
        ip_address=ip_address,
        user_agent=user_agent,
        refresh_count=1,
    )
    db.add(session)
    db.flush()
    access_token = sign_jwt(
        {
            "sub": str(user.id),
            "email": user.email,
            "sid": session.id,
            "device_id": device.id if device else None,
        },
        timedelta(minutes=settings.access_token_expire_minutes),
    )
    user.last_login_at = utcnow()
    user.failed_login_count = 0
    device_risk = 30 if not device else device.risk_score
    if device and device.trust_level != "trusted":
        device.risk_score = min(100, device.risk_score + 5)
        if device.risk_score < 60:
            device.trust_level = "trusted" if user.mfa_enabled else "untrusted"
    audit_log(
        db,
        actor_user_id=user.id,
        action="auth.session.created",
        resource_type="session",
        resource_id=str(session.id),
        ip_address=ip_address,
        device_id=device.id if device else None,
        metadata={"device_risk": device_risk},
    )
    return access_token, refresh_token, csrf_token, session


def require_mfa_challenge(user: models.User) -> bool:
    return user.mfa_enabled


def build_mfa_challenge(user: models.User) -> str:
    return sign_jwt({"sub": str(user.id), "kind": "mfa_challenge"}, timedelta(minutes=5))


def verify_mfa_code(user: models.User, code: str) -> bool:
    secret = get_mfa_secret(user)
    if not secret:
        return False
    return verify_totp(secret, code)


def set_mfa_secret(user: models.User, secret: str) -> None:
    nonce, ciphertext = encrypt_bytes(secret.encode("utf-8"))
    user.mfa_secret_encrypted = f"{nonce.hex()}:{ciphertext.hex()}"


def get_mfa_secret(user: models.User) -> str | None:
    if not user.mfa_secret_encrypted:
        return None
    try:
        nonce_hex, ciphertext_hex = user.mfa_secret_encrypted.split(":", 1)
        return decrypt_bytes(bytes.fromhex(nonce_hex), bytes.fromhex(ciphertext_hex)).decode("utf-8")
    except Exception:
        return None


def authenticate_password_login(
    db: Session,
    *,
    email: str,
    password: str,
    device_name: str | None,
    device_fingerprint: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, Any]:
    user = get_user_by_email(db, email)
    if user is None or not user.password_hash or not verify_password(user.password_hash, password):
        if user:
            user.failed_login_count += 1
            audit_log(
                db,
                actor_user_id=user.id,
                action="auth.login.failed",
                status="failed",
                resource_type="user",
                resource_id=str(user.id),
                ip_address=ip_address,
                metadata={"reason": "bad_credentials"},
            )
        return {"ok": False, "reason": "invalid_credentials"}

    device = create_or_update_device(
        db,
        user=user,
        fingerprint=device_fingerprint,
        device_name=device_name,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    anomaly_score, notes = login_anomaly_risk(
        user=user,
        device=device,
        ip_address=ip_address,
        user_agent=user_agent,
        failed_attempts=user.failed_login_count,
    )
    if anomaly_score >= 70:
        challenge_token = build_mfa_challenge(user)
        audit_log(
            db,
            actor_user_id=user.id,
            action="auth.login.challenge",
            status="challenge",
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip_address,
            device_id=device.id,
            metadata={"risk": anomaly_score, "notes": notes},
        )
        return {
            "ok": False,
            "reason": "challenge_required",
            "challenge_token": challenge_token,
            "risk": anomaly_score,
            "notes": notes,
        }

    if require_mfa_challenge(user):
        challenge_token = build_mfa_challenge(user)
        audit_log(
            db,
            actor_user_id=user.id,
            action="auth.login.mfa_required",
            status="challenge",
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip_address,
            device_id=device.id,
            metadata={"risk": anomaly_score, "notes": notes},
        )
        return {
            "ok": False,
            "reason": "mfa_required",
            "challenge_token": challenge_token,
            "risk": anomaly_score,
            "notes": notes,
        }

    access_token, refresh_token, csrf_token, session = issue_session(
        db,
        user=user,
        device=device,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    audit_log(
        db,
        actor_user_id=user.id,
        action="auth.login.success",
        resource_type="session",
        resource_id=str(session.id),
        ip_address=ip_address,
        device_id=device.id,
        metadata={"risk": anomaly_score, "notes": notes},
    )
    return {
        "ok": True,
        "user": user,
        "device": device,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "csrf_token": csrf_token,
        "session": session,
        "risk": anomaly_score,
        "notes": notes,
    }


def rotate_refresh_token(
    db: Session,
    *,
    refresh_token: str,
    csrf_token: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> dict[str, Any]:
    token_hash = hash_token(refresh_token)
    session = db.scalar(select(models.RefreshSession).where(models.RefreshSession.token_hash == token_hash))
    if session is None or session.revoked_at or is_expired(session.expires_at):
        return {"ok": False, "reason": "invalid_session"}
    if csrf_token and session.csrf_token != csrf_token:
        return {"ok": False, "reason": "csrf_mismatch"}
    user = db.get(models.User, session.user_id)
    if user is None:
        return {"ok": False, "reason": "invalid_user"}
    device = db.get(models.UserDevice, session.device_id) if session.device_id else None
    session.revoked_at = utcnow()
    access_token, new_refresh_token, new_csrf, new_session = issue_session(
        db, user=user, device=device, ip_address=ip_address, user_agent=user_agent
    )
    new_session.refresh_count = session.refresh_count + 1
    new_session.last_used_at = utcnow()
    audit_log(
        db,
        actor_user_id=user.id,
        action="auth.refresh.rotate",
        resource_type="session",
        resource_id=str(new_session.id),
        ip_address=ip_address,
        device_id=device.id if device else None,
    )
    return {
        "ok": True,
        "user": user,
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "csrf_token": new_csrf,
        "session": new_session,
    }


def revoke_refresh_token(db: Session, *, refresh_token: str | None, csrf_token: str | None) -> bool:
    if not refresh_token:
        return False
    session = db.scalar(select(models.RefreshSession).where(models.RefreshSession.token_hash == hash_token(refresh_token)))
    if session is None or session.revoked_at:
        return False
    if csrf_token and session.csrf_token != csrf_token:
        return False
    session.revoked_at = utcnow()
    return True


def create_recovery_token(
    db: Session,
    *,
    user: models.User,
    kind: str,
    delivery_target: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    token = generate_token(40)
    expires_hours = 0.17 if kind == "otp" else 24
    row = models.RecoveryToken(
        user_id=user.id,
        kind=kind,
        token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(hours=expires_hours),
        delivery_target=delivery_target,
        token_metadata=metadata,
    )
    db.add(row)
    return token


def verify_recovery_token(db: Session, *, token: str, kind: str) -> models.RecoveryToken | None:
    row = db.scalar(
        select(models.RecoveryToken).where(
            models.RecoveryToken.token_hash == hash_token(token),
            models.RecoveryToken.kind == kind,
            models.RecoveryToken.consumed_at.is_(None),
        )
    )
    if row is None or is_expired(row.expires_at):
        return None
    row.consumed_at = utcnow()
    return row


def set_user_password(user: models.User, password: str) -> None:
    user.password_hash = hash_password(password)
    user.password_changed_at = utcnow()
