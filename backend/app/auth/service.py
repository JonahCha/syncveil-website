import os
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken, User
from app.core.config import get_settings
from app.core.email import get_email_service
from app.core.jwt import create_access_token, create_refresh_token
from app.core.security import generate_otp, hash_password, hash_token, verify_password
from app.db.models import OTPAttempt
from app.db.mongodb import get_sync_mongodb

settings = get_settings()
REFRESH_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))
OTP_COLLECTION = "email_otps"
OTP_PURPOSE_EMAIL = "email_verification"


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _issue_tokens(db: Session, user: User) -> dict:
    # Create a new session record.
    # Use a unique temporary hash so concurrent inserts never collide on the unique index.
    session = RefreshToken(
        user_id=user.id,
        refresh_token_hash=f"pending-{uuid4().hex}",
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_EXPIRES_DAYS),
        last_used_at=datetime.utcnow(),
    )
    db.add(session)
    db.flush()  # Get the session ID without committing.

    # Create tokens with session_id
    session_id = str(session.id)
    access_token = create_access_token(str(user.id), session_id, {"email": user.email})
    refresh_token = create_refresh_token(str(user.id), session_id, {"email": user.email})

    # Update session with refresh token hash
    session.refresh_token_hash = hash_token(refresh_token)
    db.flush()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def register_user(db: Session, email: str, password: str) -> dict:
    normalized_email = email.lower().strip()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    verification_required = settings.EMAIL_VERIFICATION_REQUIRED
    if verification_required and settings.is_production and not settings.EMAIL_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email verification is enabled but email delivery is not configured",
        )

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        email_verified=not verification_required,
        email_verified_at=datetime.utcnow() if not verification_required else None,
    )
    db.add(user)

    verification_token = None
    tokens: dict = {}

    try:
        db.flush()

        if verification_required:
            otp_code = _create_email_verification_otp(db, user)
            if settings.EMAIL_ENABLED:
                _send_verification_email(user.email, otp_code)
            else:
                # Development fallback when email delivery is intentionally disabled.
                verification_token = otp_code
        else:
            # If verification is disabled, issue tokens immediately so the user can continue.
            tokens = _issue_tokens(db, user)

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
        **tokens,
    }


def verify_email(db: Session, token: str) -> dict:
    otp_code = token.strip()
    if not otp_code.isdigit() or len(otp_code) != settings.OTP_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code")

    now = datetime.utcnow()
    otp_hash = hash_token(otp_code)

    user = _verify_email_with_mongo(db, otp_hash, now)
    if user is None:
        user = _verify_email_with_sql(db, otp_hash, now)

    return _serialize_user(user)


def login_user(db: Session, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    user.last_login_at = datetime.utcnow()
    tokens = _issue_tokens(db, user)
    db.commit()
    return {"user": _serialize_user(user), **tokens}


def resend_verification_code(db: Session, email: str) -> dict:
    normalized_email = email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.email_verified:
        return {"success": True, "already_verified": True, "verification_token": None}

    if settings.is_production and not settings.EMAIL_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email verification is enabled but email delivery is not configured",
        )

    verification_token = None
    try:
        otp_code = _create_email_verification_otp(db, user)
        if settings.EMAIL_ENABLED:
            _send_verification_email(user.email, otp_code)
        else:
            verification_token = otp_code
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification code",
        ) from exc

    return {"success": True, "already_verified": False, "verification_token": verification_token}


def _create_email_verification_otp(db: Session, user: User) -> str:
    otp_code = generate_otp(settings.OTP_LENGTH)
    otp_hash = hash_token(otp_code)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    stored_in_mongo = _store_email_otp_in_mongo(user, otp_hash, expires_at)
    if not stored_in_mongo:
        _store_email_otp_in_sql(db, user, otp_hash, expires_at)

    return otp_code


def _store_email_otp_in_mongo(user: User, otp_hash: str, expires_at: datetime) -> bool:
    if not settings.MONGO_URI:
        return False

    try:
        collection = get_sync_mongodb()[OTP_COLLECTION]
        collection.delete_many({"user_id": str(user.id), "purpose": OTP_PURPOSE_EMAIL, "used": False})
        collection.insert_one(
            {
                "user_id": str(user.id),
                "email": user.email,
                "purpose": OTP_PURPOSE_EMAIL,
                "otp_hash": otp_hash,
                "expires_at": expires_at,
                "created_at": datetime.utcnow(),
                "used": False,
                "used_at": None,
                "attempts": 0,
            }
        )
        return True
    except Exception:
        # If Mongo is unavailable, we gracefully fall back to SQL storage.
        return False


def _store_email_otp_in_sql(db: Session, user: User, otp_hash: str, expires_at: datetime) -> None:
    db.query(OTPAttempt).filter(
        OTPAttempt.user_id == user.id,
        OTPAttempt.purpose == OTP_PURPOSE_EMAIL,
        OTPAttempt.verified.is_(False),
    ).delete(synchronize_session=False)

    db.add(
        OTPAttempt(
            user_id=user.id,
            otp_hash=otp_hash,
            purpose=OTP_PURPOSE_EMAIL,
            expires_at=expires_at,
            attempts=0,
            verified=False,
        )
    )
    db.flush()


def _verify_email_with_mongo(db: Session, otp_hash: str, now: datetime):
    if not settings.MONGO_URI:
        return None

    try:
        collection = get_sync_mongodb()[OTP_COLLECTION]
    except Exception:
        return None

    record = collection.find_one({"otp_hash": otp_hash, "purpose": OTP_PURPOSE_EMAIL})
    if not record:
        return None

    if record.get("used"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP already used")

    if record.get("expires_at") and record["expires_at"] <= now:
        collection.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": now}})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    try:
        user_id = UUID(str(record.get("user_id")))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP record")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        collection.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": now}})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.email_verified = True
    user.email_verified_at = now
    db.commit()

    collection.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": now}})
    return user


def _verify_email_with_sql(db: Session, otp_hash: str, now: datetime):
    otp_attempt = db.query(OTPAttempt).filter(
        OTPAttempt.otp_hash == otp_hash,
        OTPAttempt.purpose == OTP_PURPOSE_EMAIL,
        OTPAttempt.verified.is_(False),
    ).order_by(OTPAttempt.created_at.desc()).first()

    if not otp_attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired OTP")

    if otp_attempt.expires_at and otp_attempt.expires_at <= now:
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
    return user


def _send_verification_email(email: str, otp_code: str) -> None:
    email_service = get_email_service()
    try:
        email_service.send_verification_email(email, otp_code)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send verification email") from exc
