"""Dashboard and authenticated feature endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.adaptive_security import summarize_security_events
from app.core.security import verify_token
from app.core.vault import list_files, store_file, user_vault_stats
from app.db.models import LoginLog, Session as UserSession, User
from app.db.session import get_db

router = APIRouter(prefix="/api", tags=["dashboard"])


class AuthenticatedUser:
    def __init__(self, user: User, session: UserSession, db: Session):
        self.user = user
        self.session = session
        self.db = db


def get_current_user(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """Verify bearer access token and enforce server-side session validity."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = token.strip()

    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        session_id = payload.get("session_id")

        if not user_id or not session_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_uuid = UUID(str(user_id))
        session_uuid = UUID(str(session_id))

        user = db.query(User).filter(User.id == user_uuid).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.disabled is True:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account disabled",
            )

        now = datetime.utcnow()
        session = (
            db.query(UserSession)
            .filter(
                UserSession.id == session_uuid,
                UserSession.user_id == user_uuid,
                UserSession.revoked.is_(False),
            )
            .first()
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        expires_at = cast(datetime, session.expires_at)
        if expires_at <= now:
            session.revoked = cast(bool, True)  # type: ignore
            session.revoked_at = cast(datetime, now)  # type: ignore
            session.revoked_reason = cast(str, "expired")  # type: ignore
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        session.last_used_at = cast(datetime, now)  # type: ignore
        db.commit()

        return AuthenticatedUser(user=user, session=session, db=db)

    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _risk_label(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"


def _event_severity(reason: str | None) -> str:
    normalized = (reason or "").lower()
    if "cooldown" in normalized:
        return "high"
    if "challenge" in normalized:
        return "high"
    if "disabled" in normalized:
        return "critical"
    if "invalid_credentials" in normalized:
        return "medium"
    return "low"


def _event_message(reason: str | None, success: bool) -> str:
    if success:
        return "Successful sign-in"
    normalized = (reason or "failed_login").replace("_", " ")
    normalized = normalized.split(":", maxsplit=1)[0]
    return normalized.strip().capitalize() or "Failed sign-in"


@router.get("/dashboard")
def get_dashboard_data(current: AuthenticatedUser = Depends(get_current_user)):
    """Return authenticated dashboard data sourced from live backend state."""
    user = current.user
    now = datetime.utcnow()

    vault_stats = user_vault_stats(str(user.id))

    db_session = current.db
    failures_last_day = (
        db_session.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.success.is_(False),
            LoginLog.timestamp >= now - timedelta(hours=24),
        )
        .count()
    )

    active_sessions = (
        db_session.query(UserSession)
        .filter(
            UserSession.user_id == user.id,
            UserSession.revoked.is_(False),
            UserSession.expires_at > now,
        )
        .count()
    )

    protected_records = vault_stats["file_count"] + max(1, active_sessions)

    return {
        "protectedRecords": protected_records,
        "vaultFiles": vault_stats["file_count"],
        "threatsDetected": failures_last_day,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "emailVerified": user.email_verified,
        },
        "security": {
            "active_sessions": active_sessions,
            "failed_logins_24h": failures_last_day,
        },
    }


@router.post("/vault/upload")
def upload_file(
    file: UploadFile = File(...),
    current: AuthenticatedUser = Depends(get_current_user),
):
    """Encrypt and store a file in the local vault backend."""
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    if getattr(file, "size", 0) > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 100MB",
        )

    content = file.file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 100MB",
        )

    stored = store_file(
        str(current.user.id),
        filename=file.filename or "upload.bin",
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )

    return {
        "success": True,
        "message": "File encrypted and stored successfully.",
        "file": stored,
    }


@router.get("/vault/files")
def get_vault_files(current: AuthenticatedUser = Depends(get_current_user)):
    """Return file metadata for the authenticated user's vault."""
    return list_files(str(current.user.id))


@router.get("/monitor/breaches")
def get_breach_monitor_data(current: AuthenticatedUser = Depends(get_current_user)):
    """Return user-centric security telemetry and suspicious activity timeline."""
    user = current.user
    db_session = current.db
    now = datetime.utcnow()

    recent_logs = (
        db_session.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.timestamp >= now - timedelta(days=14),
        )
        .order_by(desc(LoginLog.timestamp))
        .limit(100)
        .all()
    )

    security_events = summarize_security_events(recent_logs)
    breaches = []
    for idx, event in enumerate(security_events[:25]):
        breaches.append(
            {
                "id": f"event-{idx}",
                "type": event.code,
                "severity": event.severity,
                "message": event.message,
            }
        )

    return {
        "breaches": breaches,
        "lastUpdated": now.isoformat() + "Z",
        "user_id": str(user.id),
        "totalEvents": len(security_events),
    }


@router.get("/security/overview")
def get_security_overview(current: AuthenticatedUser = Depends(get_current_user)):
    user = current.user
    db_session = current.db
    now = datetime.utcnow()

    logs = (
        db_session.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.timestamp >= now - timedelta(days=7),
        )
        .order_by(desc(LoginLog.timestamp))
        .all()
    )

    successes = sum(1 for log in logs if cast(bool, log.success))
    failures = sum(1 for log in logs if not cast(bool, log.success))
    unique_ips = len({log.ip_address for log in logs if cast(str, log.ip_address)})

    risk_score = min(100, failures * 8 + max(0, unique_ips - 3) * 7)
    if successes > 0 and failures / max(successes, 1) > 0.5:
        risk_score = min(100, risk_score + 15)

    return {
        "risk_score": risk_score,
        "risk_level": _risk_label(risk_score),
        "successes_7d": successes,
        "failures_7d": failures,
        "unique_ips_7d": unique_ips,
        "active_sessions": (
            db_session.query(UserSession)
            .filter(
                UserSession.user_id == user.id,
                UserSession.revoked.is_(False),
                UserSession.expires_at > now,
            )
            .count()
        ),
    }


@router.get("/security/events")
def get_security_events(
    limit: int = Query(default=20, ge=1, le=100),
    current: AuthenticatedUser = Depends(get_current_user),
):
    user = current.user
    db_session = current.db

    logs = (
        db_session.query(LoginLog)
        .filter(LoginLog.user_id == user.id)
        .order_by(desc(LoginLog.timestamp))
        .limit(limit)
        .all()
    )

    events = []
    for log in logs:
        events.append(
            {
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat() + "Z",
                "success": log.success,
                "reason": log.failure_reason,
                "ip_address": log.ip_address,
                "device_info": log.device_info,
            }
        )

    return {
        "events": events,
        "count": len(events),
    }


@router.get("/public/security-snapshot")
def get_public_security_snapshot(db: Session = Depends(get_db)):
    """
    Public anonymized security telemetry for website marketing sections.
    Uses real backend logs; no fabricated random values.
    """
    now = datetime.utcnow()
    window_start = now - timedelta(days=30)
    recent_logs = (
        db.query(LoginLog)
        .filter(LoginLog.timestamp >= window_start)
        .order_by(desc(LoginLog.timestamp))
        .limit(1500)
        .all()
    )

    total_attempts = len(recent_logs)
    failed_attempts = sum(1 for row in recent_logs if row.success is not True)
    successful_attempts = total_attempts - failed_attempts
    challenge_count = sum(
        1
        for row in recent_logs
        if (row.failure_reason or "").lower().startswith("security_challenge_required")
    )
    cooldown_count = sum(
        1
        for row in recent_logs
        if "cooldown" in (row.failure_reason or "").lower()
    )

    latest_failed = next((row for row in recent_logs if row.success is not True), None)
    last_incident = latest_failed.timestamp.isoformat() + "Z" if latest_failed else None

    trend = []
    for day_index in range(6, -1, -1):
        day_start = (now - timedelta(days=day_index)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        failed_day = sum(
            1
            for row in recent_logs
            if (not cast(bool, row.success)) and day_start <= cast(datetime, row.timestamp) < day_end
        )
        trend.append(
            {
                "date": day_start.date().isoformat(),
                "failed_attempts": failed_day,
            }
        )

    recent_events = []
    for row in recent_logs[:10]:
        failure_reason = cast(str | None, row.failure_reason)
        success = cast(bool, row.success)
        recent_events.append(
            {
                "timestamp": cast(datetime, row.timestamp).isoformat() + "Z",
                "message": _event_message(failure_reason, success),
                "severity": _event_severity(failure_reason),
                "success": success,
            }
        )

    return {
        "window_days": 30,
        "total_attempts": total_attempts,
        "successful_attempts": successful_attempts,
        "failed_attempts": failed_attempts,
        "challenge_events": challenge_count,
        "cooldown_events": cooldown_count,
        "last_incident": last_incident,
        "trend_7d": trend,
        "recent_events": recent_events,
    }
