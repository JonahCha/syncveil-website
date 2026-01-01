"""
Database Models - Production Schema
CRITICAL: All models must be immutable for audit purposes (no deletes on logs)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey, Index
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
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_email_verified', 'email', 'email_verified'),
        Index('idx_user_disabled', 'disabled'),
    )


class Session(Base):
    """
    Session model - Server-side session management
    CRITICAL: All sessions must be validated against this table
    """
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Token management
    refresh_token_hash = Column(String(255), nullable=False, unique=True, index=True)
    
    # Device information
    device_info = Column(Text, nullable=True)  # User agent
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    
    # Session lifecycle
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_used_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Revocation
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String(255), nullable=True)  # "logout", "logout_all", "admin_action", "security"
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    # Indexes
    __table_args__ = (
        Index('idx_session_user_active', 'user_id', 'revoked', 'expires_at'),
        Index('idx_session_expires', 'expires_at'),
    )


class OTPAttempt(Base):
    """
    OTP Attempt model - Two-factor authentication via email
    CRITICAL: Rate limit OTP generation and verification
    """
    __tablename__ = "otp_attempts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # OTP details
    otp_hash = Column(String(255), nullable=False)
    purpose = Column(String(50), nullable=False)  # "login", "password_reset", etc.
    
    # Lifecycle
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Verification tracking
    attempts = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    
    # Device context
    ip_address = Column(String(45), nullable=True)
    device_info = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="otp_attempts")
    
    # Indexes
    __table_args__ = (
        Index('idx_otp_user_verified', 'user_id', 'verified', 'expires_at'),
        Index('idx_otp_expires', 'expires_at'),
    )


class EmailVerification(Base):
    """
    Email Verification model - Email confirmation tokens
    CRITICAL: One-time use only
    """
    __tablename__ = "email_verifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Token
    token = Column(String(255), nullable=False, unique=True, index=True)
    
    # Lifecycle
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Verification
    verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="email_verifications")
    
    # Indexes
    __table_args__ = (
        Index('idx_email_verification_token_verified', 'token', 'verified'),
    )


class LoginLog(Base):
    """
    Login Log model - Audit trail for all login attempts
    CRITICAL: Never delete, append-only for security audit
    """
    __tablename__ = "login_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Nullable for failed attempts
    email = Column(String(255), nullable=False, index=True)  # Always log email attempted
    
    # Result
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(255), nullable=True)  # "invalid_credentials", "email_not_verified", "account_disabled", etc.
    
    # Context
    ip_address = Column(String(45), nullable=False)
    device_info = Column(Text, nullable=True)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="login_logs")
    
    # Indexes
    __table_args__ = (
        Index('idx_login_log_user_time', 'user_id', 'timestamp'),
        Index('idx_login_log_email_time', 'email', 'timestamp'),
        Index('idx_login_log_ip_time', 'ip_address', 'timestamp'),
        Index('idx_login_log_success', 'success', 'timestamp'),
    )


class AdminUser(Base):
    """
    Admin User model - Separate from regular users
    CRITICAL: Admin access is separate and privileged
    """
    __tablename__ = "admin_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Admin specific
    role = Column(String(50), nullable=False, default="admin")  # "admin", "superadmin"
    disabled = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    
    # Relationships
    actions = relationship("AdminAction", back_populates="admin", cascade="all, delete-orphan")


class AdminAction(Base):
    """
    Admin Action model - Audit log for all admin actions
    CRITICAL: Never delete, complete audit trail required
    """
    __tablename__ = "admin_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=False)
    
    # Action details
    action_type = Column(String(100), nullable=False)  # "disable_user", "revoke_session", "view_logs", etc.
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    details = Column(Text, nullable=True)  # JSON or text description
    
    # Context
    ip_address = Column(String(45), nullable=False)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    admin = relationship("AdminUser", back_populates="actions")
    target_user = relationship("User", foreign_keys=[target_user_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_admin_action_admin_time', 'admin_id', 'timestamp'),
        Index('idx_admin_action_target', 'target_user_id', 'timestamp'),
        Index('idx_admin_action_type', 'action_type', 'timestamp'),
    )
