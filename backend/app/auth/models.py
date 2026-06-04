"""Backwards-compatible aliases for auth code."""
from app.db.models import EmailVerification, Session, User

EmailVerificationToken = EmailVerification
RefreshToken = Session

__all__ = ["User", "EmailVerificationToken", "RefreshToken"]
