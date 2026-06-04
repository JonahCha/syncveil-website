"""Database models for the current SyncVeil backend."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    disabled = Column(Boolean, default=False, nullable=False)
    disabled_at = Column(DateTime, nullable=True)
    disabled_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    otp_attempts = relationship("OTPAttempt", back_populates="user", cascade="all, delete-orphan")
    email_verifications = relationship("EmailVerification", back_populates="user", cascade="all, delete-orphan")
    login_logs = relationship("LoginLog", back_populates="user", cascade="all, delete-orphan")
    connected_accounts = relationship("ConnectedAccount", back_populates="user", cascade="all, delete-orphan")
    password_resets = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    vault_files = relationship("VaultFile", back_populates="user", cascade="all, delete-orphan")
    vault_audit_logs = relationship("VaultAuditLog", back_populates="user", cascade="all, delete-orphan")
    two_factor_config = relationship("TwoFactorConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_user_email_verified", "email", "email_verified"),
        Index("idx_user_disabled", "disabled"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=False, unique=True, index=True)
    device_info = Column(Text, nullable=True)
    device_name = Column(String(200), nullable=True)
    ip_address = Column(String(45), nullable=True)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_used_at = Column(DateTime, default=_utcnow, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String(255), nullable=True)
    trusted = Column(Boolean, default=False, nullable=False)
    trusted_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        Index("idx_session_user_active", "user_id", "revoked", "expires_at"),
        Index("idx_session_expires", "expires_at"),
    )


class OTPAttempt(Base):
    __tablename__ = "otp_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    purpose = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)
    device_info = Column(Text, nullable=True)

    user = relationship("User", back_populates="otp_attempts")

    __table_args__ = (Index("idx_otp_user_verified", "user_id", "verified", "expires_at"),)


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="email_verifications")


class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=False)
    device_info = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=_utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="login_logs")

    __table_args__ = (
        Index("idx_login_log_user_time", "user_id", "timestamp"),
        Index("idx_login_log_success", "success", "timestamp"),
    )


class ConnectedAccount(Base):
    __tablename__ = "connected_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    connected_at = Column(DateTime, default=_utcnow, nullable=False)
    last_synced_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="connected_accounts")

    __table_args__ = (Index("idx_connected_account_user", "user_id", "provider"),)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)

    user = relationship("User", back_populates="password_resets")

    __table_args__ = (Index("idx_pwd_reset_user", "user_id", "used"),)


class VaultFile(Base):
    __tablename__ = "vault_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    file_name = Column(String(500), nullable=False)
    content_type = Column(String(200), nullable=False, default="application/octet-stream")
    size_bytes = Column(Integer, nullable=False, default=0)
    container_size = Column(Integer, nullable=True)
    sha256 = Column(String(64), nullable=True)
    hmac = Column(String(64), nullable=True)
    encrypted_file_key = Column(LargeBinary, nullable=True)
    compression_type = Column(String(20), nullable=False, default="zstd")
    encryption_version = Column(Integer, nullable=False, default=1)
    storage_backend = Column(String(50), nullable=False, default="postgresql")
    version = Column(Integer, nullable=False, default=1)
    malware_scan_status = Column(String(20), nullable=False, default="skipped")
    malware_scan_at = Column(DateTime, nullable=True)
    encrypted_data = Column(LargeBinary, nullable=False)
    uploaded_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=True)

    user = relationship("User", back_populates="vault_files")
    audit_logs = relationship("VaultAuditLog", back_populates="vault_file", cascade="all, delete-orphan")
    analysis = relationship("AIFileAnalysis", back_populates="file", cascade="all, delete-orphan", uselist=False)
    scan = relationship("PrivacyScan", back_populates="file", cascade="all, delete-orphan", uselist=False)

    __table_args__ = (
        Index("idx_vault_user_uploaded", "user_id", "uploaded_at"),
        Index("idx_vault_user_version", "user_id", "version"),
    )


class VaultAuditLog(Base):
    __tablename__ = "vault_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("vault_files.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    detail = Column(Text, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    user = relationship("User", back_populates="vault_audit_logs")
    vault_file = relationship("VaultFile", back_populates="audit_logs")

    __table_args__ = (
        Index("idx_vault_audit_user_time", "user_id", "created_at"),
        Index("idx_vault_audit_file", "file_id", "created_at"),
        Index("idx_vault_audit_event", "event_type", "created_at"),
    )


class TwoFactorConfig(Base):
    __tablename__ = "two_factor_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    enabled = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String(64), nullable=True)
    totp_secret_pending = Column(String(64), nullable=True)
    totp_pending_at = Column(DateTime, nullable=True)
    enabled_at = Column(DateTime, nullable=True)
    disabled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    user = relationship("User", back_populates="two_factor_config")
    recovery_codes = relationship("TwoFactorRecoveryCode", back_populates="config", cascade="all, delete-orphan")


class TwoFactorRecoveryCode(Base):
    __tablename__ = "two_factor_recovery_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    config_id = Column(UUID(as_uuid=True), ForeignKey("two_factor_configs.id"), nullable=True)
    code_hash = Column(String(64), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    config = relationship("TwoFactorConfig", back_populates="recovery_codes")

    __table_args__ = (Index("idx_2fa_recovery_user_used", "user_id", "used"),)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="admin")
    disabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    actions = relationship("AdminAction", back_populates="admin", cascade="all, delete-orphan")


class AdminAction(Base):
    __tablename__ = "admin_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=False)
    action_type = Column(String(100), nullable=False)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=False)
    timestamp = Column(DateTime, default=_utcnow, nullable=False, index=True)

    admin = relationship("AdminUser", back_populates="actions")
    target_user = relationship("User", foreign_keys=[target_user_id])


class AIFileAnalysis(Base):
    __tablename__ = "ai_file_analysis"

    id = Column(Integer, primary_key=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("vault_files.id", ondelete="CASCADE"), unique=True, nullable=False)
    file_type = Column(String(64), nullable=False)
    tags = Column(JSON, nullable=True)
    categories = Column(JSON, nullable=True)
    summary = Column(Text, nullable=False)
    sensitive_findings = Column(JSON, nullable=True)
    suspicious_findings = Column(JSON, nullable=True)
    risk_score = Column(Integer, default=0, nullable=False)
    detected_sensitive = Column(Boolean, default=False, nullable=False)

    file = relationship("VaultFile", back_populates="analysis")


class PrivacyScan(Base):
    __tablename__ = "ai_privacy_scans"

    id = Column(Integer, primary_key=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("vault_files.id", ondelete="CASCADE"), unique=True, nullable=False)
    severity = Column(String(32), nullable=False)
    explanation = Column(Text, nullable=False)
    matches = Column(JSON, nullable=True)

    file = relationship("VaultFile", back_populates="scan")


class SecurityScore(Base):
    __tablename__ = "ai_security_scores"

    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, nullable=False)
    risk_level = Column(String(32), nullable=False)
    recommendations = Column(JSON, nullable=True)
    threat_history = Column(JSON, nullable=True)
    computed_at = Column(DateTime, default=_utcnow, nullable=False)
