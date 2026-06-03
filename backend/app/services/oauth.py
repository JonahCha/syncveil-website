from __future__ import annotations

from functools import lru_cache

import httpx
from jose import jwt
from sqlalchemy.orm import Session

from app import models
from app.core.config import get_settings
from app.core.security import generate_token, hash_password

settings = get_settings()

PROVIDERS = {
    "google": {
        "jwks": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": {"https://accounts.google.com", "accounts.google.com"},
        "audience": lambda: settings.oauth_google_client_id,
    },
    "microsoft": {
        "jwks": "https://login.microsoftonline.com/common/discovery/v2.0/keys",
        "issuers": {"https://login.microsoftonline.com/common/v2.0", "https://login.microsoftonline.com/organizations/v2.0"},
        "audience": lambda: settings.oauth_microsoft_client_id,
    },
    "apple": {
        "jwks": "https://appleid.apple.com/auth/keys",
        "issuers": {"https://appleid.apple.com"},
        "audience": lambda: settings.oauth_apple_client_id,
    },
}


@lru_cache(maxsize=32)
def fetch_jwks(url: str) -> dict:
    with httpx.Client(timeout=10) as client:
        return client.get(url).json()


def _get_public_key(token: str, jwks_url: str):
    header = jwt.get_unverified_header(token)
    jwks = fetch_jwks(jwks_url)
    for key in jwks.get("keys", []):
        if key.get("kid") == header.get("kid"):
            return key
    raise ValueError("Unable to find matching JWK")


def verify_provider_token(provider: str, token: str, nonce: str | None = None) -> dict:
    if provider not in PROVIDERS:
        raise ValueError("Unsupported provider")
    cfg = PROVIDERS[provider]
    audience = cfg["audience"]()
    if not audience:
        raise ValueError(f"{provider} OAuth client id is not configured")
    key = _get_public_key(token, cfg["jwks"])
    payload = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        audience=audience,
        options={"verify_at_hash": False, "verify_iss": False},
    )
    if payload.get("iss") not in cfg["issuers"] and not str(payload.get("iss", "")).startswith(
        "https://login.microsoftonline.com/"
    ):
        raise ValueError("Invalid issuer")
    if nonce and payload.get("nonce") != nonce:
        raise ValueError("Nonce mismatch")
    if not payload.get("sub"):
        raise ValueError("Invalid provider token")
    return payload


def upsert_oauth_user(db: Session, provider: str, claims: dict) -> models.User:
    email = claims.get("email")
    subject = claims["sub"]
    user = (
        db.query(models.User)
        .filter(
            (models.User.email == email)
            | ((models.User.oauth_provider == provider) & (models.User.oauth_subject == subject))
        )
        .first()
    )
    if user is None:
        user = models.User(
            email=email,
            full_name=claims.get("name") or claims.get("given_name"),
            password_hash=hash_password(generate_token(24)),
            email_verified=bool(claims.get("email_verified", True)),
            oauth_provider=provider,
            oauth_subject=subject,
        )
        db.add(user)
        db.flush()
    else:
        user.oauth_provider = provider
        user.oauth_subject = subject
        if claims.get("email_verified"):
            user.email_verified = True
        if claims.get("name"):
            user.full_name = claims["name"]
    account = (
        db.query(models.OAuthAccount)
        .filter_by(provider=provider, provider_subject=subject)
        .one_or_none()
    )
    if account is None:
        db.add(
            models.OAuthAccount(
                user_id=user.id,
                provider=provider,
                provider_subject=subject,
                email=email,
                raw_claims=claims,
            )
        )
    else:
        account.email = email
        account.raw_claims = claims
    return user
