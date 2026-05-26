"""
Database Models - Production Schema
CRITICAL: All models must be immutable for audit purposes (no deletes on logs)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    """
    User model - Core authentication entity
    CRITICAL: Never delete users, only mark as disabled
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # Profile fields
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Email verification
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)

    # Account status
    disabled = Column(Boolean, default=False, nullable=False)
    disabled_at = Column(DateTime, nullable=True)
    disabled_reason = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    otp_attempts = relationship("OTPAttempt", back_populates="user", cascade="all, delete-orphan")
    email_verifications = relationship("EmailVerification", back_populates="user", cascade="all, delete-orphan")
    login_logs = relationship("LoginLog", back_populates="user", cascade="all, delete-orphan")
    connected_accounts = relationship("ConnectedAccount", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_user_email_verified', 'email', 'email_verified'),
        Index('idx_user_disabled', 'disabled'),
    )


class ConnectedAccount(Base):
    """
    Connected OAuth accounts (Google, Apple, Microsoft)
    """
    __tablename__ = "connected_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    provider = Column(String(50), nullable=False)          # google | apple | microsoft
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    access_token = Column(Text, nullable=True)             # encrypted in real prod
    refresh_token = Column(Text, nullable=True)

    connected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_synced_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="connected_accounts")

    __table_args__ = (
        Index('idx_connected_account_user', 'user_id', 'provider'),
    )


class Session(Base):
    """Session model - Server-side session management"""
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    refresh_token_hash = Column(String(255), nullable=False, unique=True, index=True)

    device_info = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_used_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String(255), nullable=True)

    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        Index('idx_session_user_active', 'user_id', 'revoked', 'expires_at'),
        Index('idx_session_expires', 'expires_at'),
    )


class OTPAttempt(Base):
    """OTP Attempt model - Two-factor authentication via email"""
    __tablename__ = "otp_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    otp_hash = Column(String(255), nullable=False)
    purpose = Column(String(50), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    attempts = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)

    ip_address = Column(String(45), nullable=True)
    device_info = Column(Text, nullable=True)

    user = relationship("User", back_populates="otp_attempts")

    __table_args__ = (
        Index('idx_otp_user_verified', 'user_id', 'verified', 'expires_at'),
        Index('idx_otp_expires', 'expires_at'),
    )


class EmailVerification(Base):
    """Email Verification model"""
    __tablename__ = "email_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    token = Column(String(255), nullable=False, unique=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="email_verifications")

    __table_args__ = (
        Index('idx_email_verification_token_verified', 'token', 'verified'),
    )


class LoginLog(Base):
    """Login Log model - Audit trail for all login attempts"""
    __tablename__ = "login_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    email = Column(String(255), nullable=False, index=True)

    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(255), nullable=True)

    ip_address = Column(String(45), nullable=False)
    device_info = Column(Text, nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="login_logs")

    __table_args__ = (
        Index('idx_login_log_user_time', 'user_id', 'timestamp'),
        Index('idx_login_log_email_time', 'email', 'timestamp'),
        Index('idx_login_log_ip_time', 'ip_address', 'timestamp'),
        Index('idx_login_log_success', 'success', 'timestamp'),
    )


class AdminUser(Base):
    """Admin User model"""
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    role = Column(String(50), nullable=False, default="admin")
    disabled = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    actions = relationship("AdminAction", back_populates="admin", cascade="all, delete-orphan")


class AdminAction(Base):
    """Admin Action model - Audit log"""
    __tablename__ = "admin_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=False)

    action_type = Column(String(100), nullable=False)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    details = Column(Text, nullable=True)

    ip_address = Column(String(45), nullable=False)

    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    admin = relationship("AdminUser", back_populates="actions")
    target_user = relationship("User", foreign_keys=[target_user_id])

    __table_args__ = (
        Index('idx_admin_action_admin_time', 'admin_id', 'timestamp'),
        Index('idx_admin_action_target', 'target_user_id', 'timestamp'),
        Index('idx_admin_action_type', 'action_type', 'timestamp'),
    )
