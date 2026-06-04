"""Two-Factor Authentication service layer."""
from __future__ import annotations
import json
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.totp import (
    generate_recovery_codes,
    generate_totp_secret,
    hash_recovery_code,
    provisioning_uri,
    verify_recovery_code,
    verify_totp,
)
from app.db.models import TwoFactorConfig, TwoFactorRecoveryCode, User


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_or_none(db: Session, user: User) -> Optional[TwoFactorConfig]:
    return db.query(TwoFactorConfig).filter(TwoFactorConfig.user_id == user.id).first()


def _require_config(db: Session, user: User) -> TwoFactorConfig:
    cfg = _get_or_none(db, user)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="2FA not set up")
    return cfg


# ─── Setup — step 1 ──────────────────────────────────────────────────────────

def begin_totp_setup(db: Session, user: User) -> dict:
    """
    Generate a fresh TOTP secret and return the provisioning URI + QR data.
    The secret is stored as *pending* (not yet confirmed/enabled).
    """
    secret = generate_totp_secret()
    uri    = provisioning_uri(secret, user.email)

    cfg = _get_or_none(db, user)
    if cfg is None:
        cfg = TwoFactorConfig(user_id=user.id)
        db.add(cfg)

    cfg.totp_secret_pending = secret
    cfg.totp_pending_at     = datetime.utcnow()
    db.commit()

    return {
        "secret": secret,
        "provisioning_uri": uri,
        "issuer": "SyncVeil",
        "account": user.email,
    }


# ─── Setup — step 2 (confirm) ────────────────────────────────────────────────

def confirm_totp_setup(db: Session, user: User, code: str) -> dict:
    """
    Verify the first TOTP code from the authenticator app.
    On success: activate 2FA and issue fresh recovery codes.
    """
    cfg = _require_config(db, user)
    if not cfg.totp_secret_pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No pending 2FA setup — call /2fa/setup first")

    if not verify_totp(cfg.totp_secret_pending, code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid code — check your authenticator app time sync")

    # Activate
    cfg.totp_secret  = cfg.totp_secret_pending
    cfg.totp_secret_pending = None
    cfg.totp_pending_at     = None
    cfg.enabled      = True
    cfg.enabled_at   = datetime.utcnow()

    # Purge old recovery codes
    db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
    ).delete(synchronize_session=False)

    # Issue new recovery codes
    plain_codes = generate_recovery_codes()
    for c in plain_codes:
        db.add(TwoFactorRecoveryCode(
            user_id=user.id,
            code_hash=hash_recovery_code(c),
        ))

    db.commit()
    return {"enabled": True, "recovery_codes": plain_codes}


# ─── Disable ─────────────────────────────────────────────────────────────────

def disable_totp(db: Session, user: User, code: str) -> dict:
    """Disable 2FA after verifying current TOTP or a recovery code."""
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled")

    # Accept TOTP code or recovery code
    ok = verify_totp(cfg.totp_secret, code)
    if not ok:
        ok = _try_recovery_code(db, user, code)

    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid code")

    cfg.enabled      = False
    cfg.disabled_at  = datetime.utcnow()
    cfg.totp_secret  = None
    db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"enabled": False}


# ─── Status ───────────────────────────────────────────────────────────────────

def get_2fa_status(db: Session, user: User) -> dict:
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        return {"enabled": False, "recovery_codes_remaining": 0}

    remaining = db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
        TwoFactorRecoveryCode.used.is_(False),
    ).count()

    return {
        "enabled": True,
        "enabled_at": cfg.enabled_at.isoformat() if cfg.enabled_at else None,
        "recovery_codes_remaining": remaining,
    }


# ─── Regenerate recovery codes ───────────────────────────────────────────────

def regenerate_recovery_codes(db: Session, user: User, code: str) -> dict:
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled")

    if not verify_totp(cfg.totp_secret, code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code")

    db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
    ).delete(synchronize_session=False)

    plain_codes = generate_recovery_codes()
    for c in plain_codes:
        db.add(TwoFactorRecoveryCode(user_id=user.id, code_hash=hash_recovery_code(c)))

    db.commit()
    return {"recovery_codes": plain_codes}


# ─── Login verification ──────────────────────────────────────────────────────

def verify_2fa_for_login(db: Session, user: User, code: str) -> bool:
    """
    Called during the login challenge flow when 2FA is enabled.
    Returns True if valid TOTP or valid (unused) recovery code.
    """
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        return True  # 2FA not enrolled — pass through

    if verify_totp(cfg.totp_secret, code):
        return True

    return _try_recovery_code(db, user, code)


def is_2fa_enabled(db: Session, user: User) -> bool:
    cfg = _get_or_none(db, user)
    return bool(cfg and cfg.enabled)


# ─── Internal ────────────────────────────────────────────────────────────────

def _try_recovery_code(db: Session, user: User, code: str) -> bool:
    """Consume a recovery code if valid. Returns True on success."""
    unused = db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
        TwoFactorRecoveryCode.used.is_(False),
    ).all()
    for rc in unused:
        if verify_recovery_code(code, rc.code_hash):
            rc.used    = True
            rc.used_at = datetime.utcnow()
            db.commit()
            return True
    return False
