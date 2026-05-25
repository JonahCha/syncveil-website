"""Dashboard and authenticated feature endpoints."""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional, cast
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.adaptive_security import summarize_security_events
from app.core.security import verify_token
from app.core.vault import list_files, store_file, user_vault_stats
from app.db.models import ConnectedAccount, LoginLog, Session as UserSession, User
from app.db.session import get_db

router = APIRouter(prefix="/api", tags=["dashboard"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://syncveil.software")


# ─── Auth Dependency ──────────────────────────────────────────────────────────

class AuthenticatedUser:
    def __init__(self, user: User, session: UserSession, db: Session):
        self.user = user
        self.session = session
        self.db = db


def get_current_user(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
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

        db_session = (
            db.query(UserSession)
            .filter(
                UserSession.id == session_uuid,
                UserSession.user_id == user_uuid,
                UserSession.revoked.is_(False),
                UserSession.expires_at > datetime.utcnow(),
            )
            .first()
        )

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = db.query(User).filter(User.id == user_uuid).first()
        if not user or user.disabled:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User unavailable",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthenticatedUser(user=user, session=db_session, db=db)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ─── Dashboard Overview ───────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard(auth_user: AuthenticatedUser = Depends(get_current_user)):
    db = auth_user.db
    user = auth_user.user
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    vault_stats = {"file_count": 0, "total_size": 0}
    try:
        vault_stats = user_vault_stats(str(user.id))
    except Exception:
        pass

    recent_logins = (
        db.query(LoginLog)
        .filter(LoginLog.user_id == user.id)
        .order_by(desc(LoginLog.timestamp))
        .limit(5)
        .all()
    )

    active_sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user.id,
            UserSession.revoked.is_(False),
            UserSession.expires_at > now,
        )
        .count()
    )

    failed_logins_7d = (
        db.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.success.is_(False),
            LoginLog.timestamp >= seven_days_ago,
        )
        .count()
    )

    connected = (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.user_id == user.id)
        .all()
    )

    return {
        "data": {
            "protectedRecords": vault_stats.get("file_count", 0) + active_sessions,
            "vaultFiles": vault_stats.get("file_count", 0),
            "vaultSize": vault_stats.get("total_size", 0),
            "threatsDetected": failed_logins_7d,
            "activeSessions": active_sessions,
            "memberSince": user.created_at.isoformat() if user.created_at else None,
            "lastLogin": user.last_login_at.isoformat() if user.last_login_at else None,
            "emailVerified": user.email_verified,
            "connectedAccounts": [
                {
                    "provider": c.provider,
                    "email": c.email,
                    "displayName": c.display_name,
                    "connectedAt": c.connected_at.isoformat(),
                }
                for c in connected
            ],
            "recentActivity": [
                {
                    "id": str(log.id),
                    "success": log.success,
                    "reason": log.failure_reason,
                    "ip": log.ip_address,
                    "device": log.device_info,
                    "timestamp": log.timestamp.isoformat(),
                }
                for log in recent_logins
            ],
        }
    }


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    date_of_birth: Optional[str] = None


@router.get("/profile")
def get_profile(auth_user: AuthenticatedUser = Depends(get_current_user)):
    u = auth_user.user
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "country": u.country,
        "date_of_birth": u.date_of_birth.isoformat() if u.date_of_birth else None,
        "avatar_url": u.avatar_url,
        "email_verified": u.email_verified,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    auth_user: AuthenticatedUser = Depends(get_current_user),
):
    from app.auth.service import update_user_profile
    updated = update_user_profile(
        auth_user.db,
        auth_user.user,
        full_name=payload.full_name,
        phone=payload.phone,
        country=payload.country,
        date_of_birth=payload.date_of_birth,
    )
    return {"success": True, "user": updated}


# ─── Vault ────────────────────────────────────────────────────────────────────

@router.post("/vault/upload")
async def upload_file(
    file: UploadFile = File(...),
    auth_user: AuthenticatedUser = Depends(get_current_user),
):
    content = await file.read()
    result = store_file(
        user_id=str(auth_user.user.id),
        filename=file.filename or "unnamed",
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    return {"file": result}


@router.get("/vault/files")
def get_vault_files(auth_user: AuthenticatedUser = Depends(get_current_user)):
    files = list_files(user_id=str(auth_user.user.id))
    return {"files": files}


# ─── Security ─────────────────────────────────────────────────────────────────

@router.get("/security/overview")
def get_security_overview(auth_user: AuthenticatedUser = Depends(get_current_user)):
    db = auth_user.db
    user = auth_user.user
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    active_sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user.id,
            UserSession.revoked.is_(False),
            UserSession.expires_at > now,
        )
        .count()
    )

    successes = (
        db.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.success.is_(True),
            LoginLog.timestamp >= seven_days_ago,
        )
        .count()
    )

    failures = (
        db.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.success.is_(False),
            LoginLog.timestamp >= seven_days_ago,
        )
        .count()
    )

    total = successes + failures
    failure_rate = (failures / total) if total > 0 else 0
    risk_score = min(100, int(failure_rate * 100 + failures * 5))
    risk_level = (
        "critical" if risk_score >= 80
        else "high" if risk_score >= 60
        else "medium" if risk_score >= 30
        else "low"
    )

    # Security score is inverse of risk
    security_score = max(0, 100 - risk_score)
    if user.email_verified:
        security_score = min(100, security_score + 10)

    return {
        "data": {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "security_score": security_score,
            "active_sessions": active_sessions,
            "successes_7d": successes,
            "failures_7d": failures,
        }
    }


@router.get("/security/events")
def get_security_events(
    limit: int = Query(default=20, le=100),
    auth_user: AuthenticatedUser = Depends(get_current_user),
):
    db = auth_user.db
    user = auth_user.user

    events = (
        db.query(LoginLog)
        .filter(LoginLog.user_id == user.id)
        .order_by(desc(LoginLog.timestamp))
        .limit(limit)
        .all()
    )

    return {
        "data": {
            "events": [
                {
                    "id": str(e.id),
                    "success": e.success,
                    "reason": e.failure_reason,
                    "ip_address": e.ip_address,
                    "device_info": e.device_info,
                    "timestamp": e.timestamp.isoformat(),
                }
                for e in events
            ]
        }
    }


# ─── Breach Monitor ───────────────────────────────────────────────────────────

@router.get("/monitor/breaches")
def get_breach_monitor(auth_user: AuthenticatedUser = Depends(get_current_user)):
    db = auth_user.db
    user = auth_user.user
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    suspicious = (
        db.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.success.is_(False),
            LoginLog.timestamp >= thirty_days_ago,
        )
        .order_by(desc(LoginLog.timestamp))
        .limit(20)
        .all()
    )

    breaches = []
    for log in suspicious:
        reason = log.failure_reason or "unknown"
        if "invalid_credentials" in reason:
            msg = "Failed login attempt with invalid credentials"
            severity = "medium"
        elif "cooldown" in reason:
            msg = "Account temporarily blocked due to too many attempts"
            severity = "high"
        elif "security_challenge" in reason:
            msg = "Suspicious login triggered security challenge"
            severity = "high"
        elif "account_disabled" in reason:
            msg = "Login attempted on disabled account"
            severity = "critical"
        else:
            msg = "Unusual login activity detected"
            severity = "low"

        breaches.append({
            "id": str(log.id),
            "message": msg,
            "severity": severity,
            "type": reason,
            "ip": log.ip_address,
            "timestamp": log.timestamp.isoformat(),
        })

    return {
        "breaches": {
            "breaches": breaches,
            "totalEvents": len(breaches),
        }
    }


# ─── Email Security ───────────────────────────────────────────────────────────

@router.get("/email-security")
def get_email_security(auth_user: AuthenticatedUser = Depends(get_current_user)):
    db = auth_user.db
    user = auth_user.user
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    failures_7d = (
        db.query(LoginLog)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.success.is_(False),
            LoginLog.timestamp >= seven_days_ago,
        )
        .count()
    )

    unique_ips = (
        db.query(LoginLog.ip_address)
        .filter(
            LoginLog.user_id == user.id,
            LoginLog.timestamp >= seven_days_ago,
        )
        .distinct()
        .count()
    )

    spam_risk_score = min(100, failures_7d * 8 + (unique_ips - 1) * 5)
    spam_risk_level = (
        "critical" if spam_risk_score >= 70
        else "high" if spam_risk_score >= 40
        else "medium" if spam_risk_score >= 20
        else "low"
    )

    connected = (
        db.query(ConnectedAccount)
        .filter(ConnectedAccount.user_id == user.id)
        .all()
    )

    return {
        "email": user.email,
        "email_verified": user.email_verified,
        "spam_risk_score": spam_risk_score,
        "spam_risk_level": spam_risk_level,
        "failed_attempts_7d": failures_7d,
        "unique_ips_7d": unique_ips,
        "breach_status": "clear",
        "last_checked": now.isoformat(),
        "connected_emails": [
            {
                "provider": c.provider,
                "email": c.email,
                "connected_at": c.connected_at.isoformat(),
            }
            for c in connected
        ],
    }


# ─── Connected Accounts ───────────────────────────────────────────────────────

@router.get("/connected-accounts")
def get_connected_accounts(auth_user: AuthenticatedUser = Depends(get_current_user)):
    accounts = (
        auth_user.db.query(ConnectedAccount)
        .filter(ConnectedAccount.user_id == auth_user.user.id)
        .all()
    )
    return {
        "accounts": [
            {
                "id": str(a.id),
                "provider": a.provider,
                "email": a.email,
                "display_name": a.display_name,
                "avatar_url": a.avatar_url,
                "connected_at": a.connected_at.isoformat(),
                "last_synced_at": a.last_synced_at.isoformat() if a.last_synced_at else None,
            }
            for a in accounts
        ]
    }


@router.delete("/connected-accounts/{provider}")
def disconnect_account(
    provider: str,
    auth_user: AuthenticatedUser = Depends(get_current_user),
):
    account = (
        auth_user.db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == auth_user.user.id,
            ConnectedAccount.provider == provider,
        )
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Connected account not found")

    auth_user.db.delete(account)
    auth_user.db.commit()
    return {"success": True, "provider": provider}


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@router.get("/auth/google")
def google_oauth_init(auth_user: AuthenticatedUser = Depends(get_current_user)):
    """Returns the Google OAuth URL for the frontend to redirect to."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )

    import urllib.parse
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{FRONTEND_URL}/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": str(auth_user.user.id),
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"url": url}


@router.post("/auth/google/callback")
def google_oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """Handles the Google OAuth callback and connects the account."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    import httpx

    try:
        user_uuid = UUID(state)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Exchange code for tokens
    token_response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{FRONTEND_URL}/oauth/google/callback",
            "grant_type": "authorization_code",
        },
    )

    if not token_response.is_success:
        raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    # Get user info from Google
    user_info_response = httpx.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if not user_info_response.is_success:
        raise HTTPException(status_code=400, detail="Failed to fetch Google profile")

    google_user = user_info_response.json()

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Upsert connected account
    existing = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == user.id,
            ConnectedAccount.provider == "google",
        )
        .first()
    )

    if existing:
        existing.email = google_user.get("email")
        existing.display_name = google_user.get("name")
        existing.avatar_url = google_user.get("picture")
        existing.access_token = access_token
        existing.last_synced_at = datetime.utcnow()
    else:
        db.add(ConnectedAccount(
            user_id=user.id,
            provider="google",
            provider_user_id=google_user.get("id", ""),
            email=google_user.get("email"),
            display_name=google_user.get("name"),
            avatar_url=google_user.get("picture"),
            access_token=access_token,
        ))

    # Optionally update user avatar if not set
    if not user.avatar_url and google_user.get("picture"):
        user.avatar_url = google_user.get("picture")

    db.commit()
    return {"success": True, "provider": "google", "email": google_user.get("email")}


# ─── Public Snapshot ──────────────────────────────────────────────────────────

@router.get("/public/security-snapshot")
def get_public_security_snapshot(db: Session = Depends(get_db)):
    try:
        total_users = db.query(User).filter(User.disabled.is_(False)).count()
        total_events = db.query(LoginLog).count()
        return {
            "data": {
                "totalUsers": total_users,
                "totalEvents": total_events,
                "status": "operational",
                "lastUpdated": datetime.utcnow().isoformat(),
            }
        }
    except Exception:
        return {
            "data": {
                "totalUsers": 0,
                "totalEvents": 0,
                "status": "operational",
                "lastUpdated": datetime.utcnow().isoformat(),
            }
        }
