from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class MessageResponse(BaseModel):
    message: str


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    csrf_token: str
    expires_in: int


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    email_verified: bool
    mfa_enabled: bool
    created_at: datetime


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    full_name: str | None = Field(default=None, max_length=255)
    device_name: str | None = Field(default="Browser")
    device_fingerprint: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_name: str | None = Field(default="Browser")
    device_fingerprint: str | None = None


class OAuthLoginRequest(BaseModel):
    id_token: str
    device_name: str | None = Field(default="Browser")
    device_fingerprint: str | None = None
    nonce: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = None
    csrf_token: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
    csrf_token: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=12, max_length=256)


class VerifyRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class MfaEnableRequest(BaseModel):
    code: str


class MfaVerifyRequest(BaseModel):
    email: EmailStr
    code: str


class DeviceRead(BaseModel):
    id: int
    name: str
    fingerprint: str
    trust_level: str
    risk_score: int
    last_seen_at: datetime | None
    revoked_at: datetime | None


class SecurityEventRead(BaseModel):
    id: int
    event_type: str
    severity: str
    description: str
    score_impact: int
    metadata: dict[str, Any] | None
    created_at: datetime


class FileAnalysisRead(BaseModel):
    id: int
    file_id: int
    file_type: str
    tags: list[str] | None
    categories: list[str] | None
    summary: str
    sensitive_findings: list[dict[str, Any]] | None
    suspicious_findings: list[str] | None
    risk_score: int
    detected_sensitive: bool


class PrivacyScanRead(BaseModel):
    id: int
    file_id: int
    severity: str
    explanation: str
    matches: list[dict[str, Any]] | None


class SecurityScoreRead(BaseModel):
    score: int
    risk_level: str
    recommendations: list[str] | None
    threat_history: list[dict[str, Any]] | None
    computed_at: datetime


class DashboardRead(BaseModel):
    security_score: int
    risk_level: str
    recommendations: list[str]
    threat_history: list[dict[str, Any]]
    upload_activity: list[dict[str, Any]]
    storage_usage: list[dict[str, Any]]
    user_activity: list[dict[str, Any]]
    sharing_activity: list[dict[str, Any]]
    security_events: list[dict[str, Any]]

