from __future__ import annotations

import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.config import get_settings
from app.core.security import generate_token, hash_token, is_expired, utcnow, verify_jwt, verify_totp
from app.deps import current_user, db_dep
from app.services.audit import audit_log
from app.services.auth import (
    authenticate_password_login,
    build_mfa_challenge,
    create_recovery_token,
    create_user,
    get_user_by_email,
    issue_session,
    revoke_refresh_token,
    rotate_refresh_token,
    set_mfa_secret,
    set_user_password,
    verify_mfa_code,
    verify_recovery_token,
)
from app.services.email import send_email
from app.services.oauth import upsert_oauth_user, verify_provider_token
from app.core.security import build_csrf_token, create_totp_secret
from app.services.auth import get_mfa_secret

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookies(response: Response, refresh_token: str, csrf_token: str) -> None:
    secure = settings.env == "production"
    response.set_cookie(
        settings.refresh_cookie_name,
        refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        path="/",
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(settings.refresh_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


def _request_context(request: Request) -> tuple[str | None, str | None]:
    ip_address = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent")
    return ip_address, user_agent


def _csrf_matches(request: Request, provided: str | None) -> bool:
    cookie = request.cookies.get(settings.csrf_cookie_name)
    header = request.headers.get("x-csrf-token")
    if provided:
        header = provided
    return bool(cookie and header and cookie == header)


@router.post("/signup", response_model=schemas.AuthTokens)
def signup(payload: schemas.SignupRequest, request: Request, response: Response, db: Session = Depends(db_dep)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    ip_address, user_agent = _request_context(request)
    user = create_user(db, email=payload.email, password=payload.password, full_name=payload.full_name)
    device = None
    if payload.device_fingerprint or payload.device_name:
        from app.services.auth import create_or_update_device

        device = create_or_update_device(
            db,
            user=user,
            fingerprint=payload.device_fingerprint,
            device_name=payload.device_name,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    if settings.email_verification_required:
        token = create_recovery_token(db, user=user, kind="email_verification", delivery_target=user.email)
        send_email(
            user.email,
            "Verify your SyncVeil account",
            f"Your verification link: {settings.frontend_url}/verify-email?token={token}",
        )
    access_token, refresh_token, csrf_token, _session = issue_session(
        db, user=user, device=device, ip_address=ip_address, user_agent=user_agent
    )
    _set_session_cookies(response, refresh_token, csrf_token)
    db.commit()
    return schemas.AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/login")
def login(payload: schemas.LoginRequest, request: Request, response: Response, db: Session = Depends(db_dep)):
    ip_address, user_agent = _request_context(request)
    result = authenticate_password_login(
        db,
        email=payload.email,
        password=payload.password,
        device_name=payload.device_name,
        device_fingerprint=payload.device_fingerprint,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    if not result["ok"]:
        db.commit()
        if result["reason"] in {"challenge_required", "mfa_required"}:
            return {
                "status": result["reason"],
                "challenge_token": result["challenge_token"],
                "risk": result["risk"],
                "notes": result["notes"],
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_session_cookies(response, result["refresh_token"], result["csrf_token"])
    db.commit()
    return schemas.AuthTokens(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        csrf_token=result["csrf_token"],
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/login/challenge")
def login_challenge(payload: schemas.MfaVerifyRequest, request: Request, response: Response, db: Session = Depends(db_dep)):
    user = get_user_by_email(db, payload.email)
    if not user or not user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA not enabled")
    if not verify_mfa_code(user, payload.code):
        audit_log(db, actor_user_id=user.id, action="auth.mfa.failed", status="failed", resource_type="user", resource_id=str(user.id))
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid MFA code")
    ip_address, user_agent = _request_context(request)
    device = None
    access_token, refresh_token, csrf_token, _session = issue_session(
        db, user=user, device=device, ip_address=ip_address, user_agent=user_agent
    )
    _set_session_cookies(response, refresh_token, csrf_token)
    db.commit()
    return schemas.AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/oauth/{provider}")
def oauth_login(
    provider: str,
    payload: schemas.OAuthLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(db_dep),
):
    ip_address, user_agent = _request_context(request)
    claims = verify_provider_token(provider, payload.id_token, payload.nonce)
    user = upsert_oauth_user(db, provider, claims)
    from app.services.auth import create_or_update_device

    device = create_or_update_device(
        db,
        user=user,
        fingerprint=payload.device_fingerprint,
        device_name=payload.device_name,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    access_token, refresh_token, csrf_token, _session = issue_session(
        db, user=user, device=device, ip_address=ip_address, user_agent=user_agent
    )
    db.commit()
    _set_session_cookies(response, refresh_token, csrf_token)
    return schemas.AuthTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/verify")
def verify_email(token: str, db: Session = Depends(db_dep)):
    row = verify_recovery_token(db, token=token, kind="email_verification")
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    user = db.get(models.User, row.user_id)
    if user:
        user.email_verified = True
        audit_log(db, actor_user_id=user.id, action="auth.email_verified", resource_type="user", resource_id=str(user.id))
    db.commit()
    return {"message": "Email verified"}


@router.post("/resend-verification")
def resend_verification(payload: schemas.ResendVerificationRequest, db: Session = Depends(db_dep)):
    user = get_user_by_email(db, payload.email)
    if not user:
        return {"message": "If the account exists, a verification link has been sent."}
    token = create_recovery_token(db, user=user, kind="email_verification", delivery_target=user.email)
    send_email(
        user.email,
        "Verify your SyncVeil account",
        f"Your verification link: {settings.frontend_url}/verify-email?token={token}",
    )
    db.commit()
    return {"message": "If the account exists, a verification link has been sent."}


@router.post("/refresh", response_model=schemas.AuthTokens)
def refresh(
    request: Request,
    response: Response,
    payload: schemas.RefreshRequest,
    db: Session = Depends(db_dep),
):
    refresh_token = payload.refresh_token or request.cookies.get(settings.refresh_cookie_name)
    csrf_token = payload.csrf_token or request.headers.get("x-csrf-token") or request.cookies.get(settings.csrf_cookie_name)
    if not refresh_token or not _csrf_matches(request, csrf_token):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    result = rotate_refresh_token(
        db,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        ip_address=_request_context(request)[0],
        user_agent=_request_context(request)[1],
    )
    if not result["ok"]:
        db.commit()
        raise HTTPException(status_code=401, detail=result["reason"])
    _set_session_cookies(response, result["refresh_token"], result["csrf_token"])
    db.commit()
    return schemas.AuthTokens(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        csrf_token=result["csrf_token"],
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout")
def logout(request: Request, response: Response, payload: schemas.LogoutRequest, db: Session = Depends(db_dep)):
    refresh_token = payload.refresh_token or request.cookies.get(settings.refresh_cookie_name)
    csrf_token = payload.csrf_token or request.headers.get("x-csrf-token") or request.cookies.get(settings.csrf_cookie_name)
    if refresh_token and _csrf_matches(request, csrf_token):
        revoke_refresh_token(db, refresh_token=refresh_token, csrf_token=csrf_token)
    _clear_session_cookies(response)
    db.commit()
    return {"message": "Logged out"}


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(db_dep)):
    user = get_user_by_email(db, payload.email)
    if not user:
        return {"message": "If the account exists, reset instructions have been sent."}
    token = create_recovery_token(db, user=user, kind="password_reset", delivery_target=user.email)
    send_email(
        user.email,
        "Reset your SyncVeil password",
        f"Reset link: {settings.frontend_url}/reset-password?token={token}",
    )
    audit_log(db, actor_user_id=user.id, action="auth.password_reset_requested", resource_type="user", resource_id=str(user.id))
    db.commit()
    return {"message": "If the account exists, reset instructions have been sent."}


@router.post("/otp/request")
def otp_request(payload: schemas.ForgotPasswordRequest, db: Session = Depends(db_dep)):
    user = get_user_by_email(db, payload.email)
    if not user:
        return {"message": "If the account exists, an OTP code has been sent."}
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        models.RecoveryToken(
            user_id=user.id,
            kind="otp",
            token_hash=hash_token(code),
            expires_at=utcnow() + timedelta(minutes=10),
            delivery_target=user.email,
            token_metadata={"purpose": "account_recovery"},
        )
    )
    send_email(user.email, "Your SyncVeil OTP", f"Your one-time code is: {code}")
    db.commit()
    return {"message": "If the account exists, an OTP code has been sent."}


@router.post("/otp/verify")
def otp_verify(payload: schemas.MfaVerifyRequest, db: Session = Depends(db_dep)):
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid code")
    token = db.scalar(
        select(models.RecoveryToken).where(
            models.RecoveryToken.user_id == user.id,
            models.RecoveryToken.kind == "otp",
            models.RecoveryToken.consumed_at.is_(None),
            models.RecoveryToken.token_hash == hash_token(payload.code),
        )
    )
    if token is None or is_expired(token.expires_at):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    token.consumed_at = utcnow()
    audit_log(db, actor_user_id=user.id, action="auth.otp_verified", resource_type="user", resource_id=str(user.id))
    db.commit()
    return {"message": "OTP verified"}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(db_dep)):
    row = verify_recovery_token(db, token=payload.token, kind="password_reset")
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.get(models.User, row.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    set_user_password(user, payload.password)
    audit_log(db, actor_user_id=user.id, action="auth.password_reset_complete", resource_type="user", resource_id=str(user.id))
    db.commit()
    return {"message": "Password updated"}


@router.post("/mfa/setup", response_model=schemas.MfaSetupResponse)
def mfa_setup(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    secret = create_totp_secret()
    set_mfa_secret(user, secret)
    db.commit()
    return schemas.MfaSetupResponse(secret=secret, otpauth_url=f"otpauth://totp/SyncVeil:{user.email}?secret={secret}&issuer=SyncVeil")


@router.post("/mfa/enable")
def mfa_enable(payload: schemas.MfaEnableRequest, user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    secret = get_mfa_secret(user)
    if not secret or not verify_totp(secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    user.mfa_enabled = True
    db.commit()
    return {"message": "MFA enabled"}


@router.get("/me", response_model=schemas.UserRead)
def me(user: models.User = Depends(current_user)):
    return schemas.UserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        email_verified=user.email_verified,
        mfa_enabled=user.mfa_enabled,
        created_at=user.created_at,
    )
