import os
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import EmailVerificationToken, RefreshToken, User
from app.core.jwt import create_access_token, create_refresh_token
from app.core.security import hash_password, hash_token, verify_password

AUTO_VERIFY_EMAIL = os.getenv("AUTO_VERIFY_EMAIL", "true").lower() == "true"
VERIFICATION_EXPIRY_HOURS = int(os.getenv("VERIFICATION_TOKEN_EXPIRE_HOURS", "24"))
REFRESH_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _issue_tokens(db: Session, user: User) -> dict:
    access_token = create_access_token(str(user.id), {"email": user.email})
    refresh_token = create_refresh_token(str(user.id), {"email": user.email})
    token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_EXPIRES_DAYS),
    )
    db.add(token_record)
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def register_user(db: Session, email: str, password: str) -> dict:
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=email.lower(), password_hash=hash_password(password), email_verified=AUTO_VERIFY_EMAIL)
    db.add(user)
    db.commit()
    db.refresh(user)

    verification_token = None
    if not AUTO_VERIFY_EMAIL:
        verification_token = EmailVerificationToken(
            user_id=user.id,
            token=str(uuid.uuid4()),
            expires_at=datetime.utcnow() + timedelta(hours=VERIFICATION_EXPIRY_HOURS),
        )
        db.add(verification_token)
        db.commit()

    tokens = _issue_tokens(db, user)
    return {
        "user": _serialize_user(user),
        **tokens,
        "verification_token": verification_token.token if verification_token else None,
    }


def verify_email(db: Session, token: str) -> dict:
    record = db.query(EmailVerificationToken).filter(EmailVerificationToken.token == token).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification token not found")
    
    if record.expires_at < datetime.utcnow():
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token expired")

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.email_verified = True
    db.delete(record)
    db.commit()
    return _serialize_user(user)


def login_user(db: Session, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.email_verified and not AUTO_VERIFY_EMAIL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    tokens = _issue_tokens(db, user)
    return {"user": _serialize_user(user), **tokens}