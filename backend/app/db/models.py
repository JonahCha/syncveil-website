"""Compatibility layer for old imports - re-exports from app.models"""
from app.models import (
    User,
    OAuthAccount,
    RefreshSession,
    UserDevice,
    RecoveryToken,
    AuditLog,
    SecurityEvent,
    VaultFile,
    AIFileAnalysis,
    PrivacyScan,
    SecurityScore,
)

__all__ = [
    "User",
    "OAuthAccount",
    "RefreshSession",
    "UserDevice",
    "RecoveryToken",
    "AuditLog",
    "SecurityEvent",
    "VaultFile",
    "AIFileAnalysis",
    "PrivacyScan",
    "SecurityScore",
]
