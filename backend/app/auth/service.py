from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken, User
from app.core.adaptive_security import compute_login_risk, prune_security_artifacts
from app.core.config import get_settings
from app.core.email import get_email_service
from app.core.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.core.security import (
    generate_otp,
    hash_password,
    hash_token,
    verify_password,
    verify_token_hash,
)
from app.db.models import LoginLog, OTPAttempt

logger = logging.getLogger(__name__)
settings = get_settings()
REFRESH_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", str(settings.REFRESH_TOKEN_EXPIRE_DAYS)))
OTP_PURPOSE_EMAIL = "email_verification"
OTP_PURPOSE_LOGIN_CHALLENGE = "login_challenge"


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": getattr(user, 'full_name', None),
        "phone": getattr(user, 'phone', None),
        "country": getattr(user, 'country', None),
        "date_of_birth": user.date_of_birth.isoformat() if getattr(user, 'date_of_birth', None) else None,
        "avatar_url": getattr(user, 'avatar_url', None),
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


def _record_login_attempt(
    db: Session,
    *,
    email: str,
    ip_address: str,
    user_agent: str,
    success: bool,
    user: User | None = None,
    reason: str | None = None,
) -> None:
    db.add(
        LoginLog(
            user_id=user.id if user else None,
            email=email,
            success=success,
            failure_reason=reason,
            ip_address=ip_address,
            device_info=user_agent,
            timestamp=datetime.utcnow(),
        )
    )


def _issue_tokens(
    db: Session,
    user: User,
    *,
    ip_address: str,
    user_agent: str,
    existing_session: RefreshToken | None = None,
) -> dict:
    now = datetime.utcnow()

    if existing_session is None:
        session = RefreshToken(
            user_id=user.id,
            refresh_token_hash=f"pending-{uuid4().hex}",
            expires_at=now + timedelta(days=REFRESH_EXPIRES_DAYS),
            last_used_at=now,
            ip_address=ip_address,
            device_info=user_agent,
        )
        db.add(session)
        db.flush()
    else:
        session = existing_session
        session.last_used_at = now
        session.ip_address = ip_address
        session.device_info = user_agent

    session_id = str(session.id)
    access_token = create_access_token(str(user.id), session_id, {"email": user.email})
    refresh_token = create_refresh_token(str(user.id), session_id, {"email": user.email})

    session.refresh_token_hash = hash_token(refresh_token)
    db.flush()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def _try_send_verification_email(email: str, otp_code: str) -> bool:
    """
    Try to send verification email.
    Returns True on success, False on failure — never raises.
    """
    try:
        email_service = get_email_service()
        email_service.send_verification_email(email, otp_code)
        logger.info(f"Verification email sent to {email}")
        return True
    except Exception as exc:
        logger.warning(f"Email send failed for {email}: {exc}. Continuing without email verification.")
        return False


def _try_send_otp_email(email: str, otp_code: str) -> bool:
    """Try to send OTP email. Returns True on success, False on failure."""
    try:
        email_service = get_email_service()
        email_service.send_otp_email(email, otp_code)
        return True
    except Exception as exc:
        logger.warning(f"OTP email send failed for {email}: {exc}")
        return False


def register_user(
    db: Session,
    email: str,
    password: str,
    full_name: str | None = None,
    phone: str | None = None,
    country: str | None = None,
    date_of_birth: str | None = None,
) -> dict:
    normalized_email = email.lower().strip()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Parse date_of_birth safely
    dob = None
    if date_of_birth:
        try:
            from datetime import date
            dob = date.fromisoformat(date_of_birth)
        except (ValueError, TypeError):
            dob = None

    # Build user — start with email_verified=False
    user_kwargs = dict(
        email=normalized_email,
        password_hash=hash_password(password),
        email_verified=False,
        email_verified_at=None,
    )
    # Set profile fields if columns exist
    try:
        user_kwargs.update(
            full_name=full_name.strip() if full_name else None,
            phone=phone.strip() if phone else None,
            country=country.strip() if country else None,
            date_of_birth=dob,
        )
    except Exception:
        pass

    user = User(**user_kwargs)
    db.add(user)

    verification_token = None
    tokens: dict = {}
    email_sent = False
    verification_required = settings.EMAIL_VERIFICATION_REQUIRED

    try:
        db.flush()

        if verification_required and settings.EMAIL_ENABLED:
            # Try to send email — if it fails, auto-verify so user isn't blocked
            otp_code = _create_otp(db, user, OTP_PURPOSE_EMAIL)
            email_sent = _try_send_verification_email(user.email, otp_code)

            if email_sent:
                # Email sent OK — user must verify
                verification_token = None
            else:
                # Email failed — auto-verify so signup still works
                user.email_verified = True
                user.email_verified_at = datetime.utcnow()
                tokens = _issue_tokens(db, user, ip_address="0.0.0.0", user_agent="signup")
        else:
            # No email verification required — auto-verify
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
            tokens = _issue_tokens(db, user, ip_address="0.0.0.0", user_agent="signup")

        db.commit()
        db.refresh(user)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user",
        ) from exc

    return {
        "user": _serialize_user(user),
        "verification_token": verification_token,
        "email_sent": email_sent,
        "requires_verification": email_sent and not user.email_verified,
        **tokens,
    }


def update_user_profile(
    db: Session,
    user: User,
    full_name: str | None = None,
    phone: str | None = None,
    country: str | None = None,
    date_of_birth: str | None = None,
) -> dict:
    if full_name is not None:
        user.full_name = full_name.strip() or None
    if phone is not None:
        user.phone = phone.strip() or None
    if country is not None:
        user.country = country.strip() or None
    if date_of_birth is not None:
        try:
            from datetime import date
            user.date_of_birth = date.fromisoformat(date_of_birth) if date_of_birth else None
        except (ValueError, TypeError):
            pass
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


def verify_email(db: Session, token: str) -> dict:
    otp_code = token.strip()
    if not otp_code.isdigit() or len(otp_code) != settings.OTP_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code")

    now = datetime.utcnow()
    otp_hash = hash_token(otp_code)

    otp_attempt = (
        db.query(OTPAttempt)
        .filter(
            OTPAttempt.otp_hash == otp_hash,
            OTPAttempt.purpose == OTP_PURPOSE_EMAIL,
            OTPAttempt.verified.is_(False),
        )
        .order_by(OTPAttempt.created_at.desc())
        .first()
    )

    if not otp_attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired OTP")

    if otp_attempt.expires_at <= now:
        otp_attempt.verified = True
        otp_attempt.verified_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    user = db.query(User).filter(User.id == otp_attempt.user_id).first()
    if not user:
        otp_attempt.verified = True
        otp_attempt.verified_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    otp_attempt.verified = True
    otp_attempt.verified_at = now
    otp_attempt.attempts = (otp_attempt.attempts or 0) + 1
    user.email_verified = True
    user.email_verified_at = now
    db.commit()
    return _serialize_user(user)


def login_user(
    db: Session,
    email: str,
    password: str,
    *,
    ip_address: str,
    user_agent: str,
) -> dict:
    normalized_email = email.lower().strip()
    now = datetime.utcnow()

    try:
        prune_security_artifacts(db, now=now)
    except Exception:
        db.rollback()

    user = db.query(User).filter(User.email == normalized_email).first()

    if user and user.disabled:
        _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=False, user=user, reason="account_disabled")
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    risk = compute_login_risk(db, user=user, email=normalized_email, ip_address=ip_address, user_agent=user_agent, now=now)

    if risk.action == "block_temporarily" and risk.cooldown_until:
        retry_after = max(1, int((risk.cooldown_until - now).total_seconds()))
        _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=False, user=user, reason=f"cooldown_active:{retry_after}s")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": "Too many recent failed attempts. Please try again later.", "retry_after_seconds": retry_after},
        )

    if not user or not verify_password(password, user.password_hash):
        _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=False, user=user, reason="invalid_credentials")
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.email_verified:
        _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=False, user=user, reason="email_not_verified")
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    if risk.action == "challenge":
        otp_code = _create_otp(db, user, OTP_PURPOSE_LOGIN_CHALLENGE)
        challenge_token = None
        email_sent = _try_send_otp_email(user.email, otp_code)
        if not email_sent:
            challenge_token = otp_code  # fallback: return code directly

        _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=False, user=user, reason=f"security_challenge_required:{risk.level}:{risk.score}")
        db.commit()

        return {
            "challenge_required": True,
            "email": user.email,
            "challenge_token": challenge_token,
            "risk": {"score": risk.score, "level": risk.level, "reasons": risk.reasons},
            "message": "Additional verification required for this login attempt.",
        }

    user.last_login_at = now
    tokens = _issue_tokens(db, user, ip_address=ip_address, user_agent=user_agent)
    _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=True, user=user, reason=f"risk:{risk.level}:{risk.score}")
    db.commit()

    return {"user": _serialize_user(user), **tokens}


def verify_login_challenge(
    db: Session,
    email: str,
    code: str,
    *,
    ip_address: str,
    user_agent: str,
) -> dict:
    normalized_email = email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    normalized_code = code.strip()
    if not normalized_code.isdigit() or len(normalized_code) != settings.OTP_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid challenge code")

    _verify_user_otp(db, user, purpose=OTP_PURPOSE_LOGIN_CHALLENGE, otp_code=normalized_code, mark_email_verified=False)

    user.last_login_at = datetime.utcnow()
    tokens = _issue_tokens(db, user, ip_address=ip_address, user_agent=user_agent)
    _record_login_attempt(db, email=normalized_email, ip_address=ip_address, user_agent=user_agent, success=True, user=user, reason="security_challenge_passed")
    db.commit()

    return {"user": _serialize_user(user), **tokens, "challenge_verified": True}


def resend_verification_code(db: Session, email: str) -> dict:
    normalized_email = email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.email_verified:
        return {"success": True, "already_verified": True, "verification_token": None}

    verification_token = None
    try:
        otp_code = _create_otp(db, user, OTP_PURPOSE_EMAIL)
        email_sent = _try_send_verification_email(user.email, otp_code)
        if not email_sent:
            verification_token = otp_code
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to resend verification code") from exc

    return {"success": True, "already_verified": False, "verification_token": verification_token}


def refresh_access_token(db: Session, refresh_token: str, *, ip_address: str, user_agent: str) -> dict:
    payload = decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    session_id = payload.get("session_id")
    user_id = payload.get("sub")

    try:
        user_uuid = UUID(str(user_id))
        session_uuid = UUID(str(session_id))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token payload") from exc

    session = (
        db.query(RefreshToken)
        .filter(RefreshToken.id == session_uuid, RefreshToken.user_id == user_uuid, RefreshToken.revoked.is_(False))
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

    if session.expires_at <= datetime.utcnow():
        session.revoked = True
        session.revoked_at = datetime.utcnow()
        session.revoked_reason = "expired"
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    if not verify_token_hash(refresh_token, session.refresh_token_hash):
        session.revoked = True
        session.revoked_at = datetime.utcnow()
        session.revoked_reason = "security"
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user or user.disabled:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    tokens = _issue_tokens(db, user, ip_address=ip_address, user_agent=user_agent, existing_session=session)
    db.commit()
    return {"user": _serialize_user(user), **tokens}


def logout_user(db: Session, *, refresh_token: str | None, ip_address: str, user_agent: str, all_devices: bool) -> dict:
    if not refresh_token:
        return {"success": True, "revoked": 0}

    payload = decode_refresh_token(refresh_token)
    if not payload:
        return {"success": True, "revoked": 0}

    try:
        user_uuid = UUID(str(payload.get("sub")))
        session_uuid = UUID(str(payload.get("session_id")))
    except Exception:
        return {"success": True, "revoked": 0}

    query = db.query(RefreshToken).filter(RefreshToken.user_id == user_uuid, RefreshToken.revoked.is_(False))
    if not all_devices:
        query = query.filter(RefreshToken.id == session_uuid)

    sessions = query.all()
    now = datetime.utcnow()
    for session in sessions:
        session.revoked = True
        session.revoked_at = now
        session.revoked_reason = "logout_all" if all_devices else "logout"
        session.last_used_at = now
        session.ip_address = ip_address
        session.device_info = user_agent

    db.commit()
    return {"success": True, "revoked": len(sessions)}


def _create_otp(db: Session, user: User, purpose: str) -> str:
    otp_code = generate_otp(settings.OTP_LENGTH)
    otp_hash = hash_token(otp_code)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    db.query(OTPAttempt).filter(
        OTPAttempt.user_id == user.id,
        OTPAttempt.purpose == purpose,
        OTPAttempt.verified.is_(False),
    ).delete(synchronize_session=False)

    db.add(OTPAttempt(
        user_id=user.id,
        otp_hash=otp_hash,
        purpose=purpose,
        expires_at=expires_at,
        attempts=0,
        verified=False,
    ))
    db.flush()
    return otp_code


def _verify_user_otp(db: Session, user: User, *, purpose: str, otp_code: str, mark_email_verified: bool) -> None:
    now = datetime.utcnow()
    otp_hash = hash_token(otp_code)

    otp_attempt = (
        db.query(OTPAttempt)
        .filter(OTPAttempt.user_id == user.id, OTPAttempt.purpose == purpose, OTPAttempt.verified.is_(False))
        .order_by(OTPAttempt.created_at.desc())
        .first()
    )

    if not otp_attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired OTP")

    if otp_attempt.expires_at <= now:
        otp_attempt.verified = True
        otp_attempt.verified_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    otp_attempt.attempts = (otp_attempt.attempts or 0) + 1

    if otp_attempt.otp_hash != otp_hash:
        if otp_attempt.attempts >= settings.OTP_MAX_ATTEMPTS:
            otp_attempt.verified = True
            otp_attempt.verified_at = now
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code")

    otp_attempt.verified = True
    otp_attempt.verified_at = now

    if mark_email_verified:
        user.email_verified = True
        user.email_verified_at = now
