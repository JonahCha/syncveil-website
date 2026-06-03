from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Iterable

import pyotp
from argon2 import PasswordHasher
from argon2.low_level import Type
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import jwt

from app.core.config import get_settings

settings = get_settings()
password_hasher = PasswordHasher(
    type=Type.ID,
    time_cost=2,
    memory_cost=65536,
    parallelism=1,
)


def utcnow() -> datetime:
    return datetime.now(UTC)


def is_expired(value: datetime | None) -> bool:
    if value is None:
        return True
    if value.tzinfo is None:
        return value <= datetime.now(UTC).replace(tzinfo=None)
    return value <= utcnow()


def normalize_key(value: str) -> bytes:
    try:
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    if len(value.encode("utf-8")) == 32:
        return value.encode("utf-8")
    return hashlib.sha256(value.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(hash_value: str, password: str) -> bool:
    try:
        return password_hasher.verify(hash_value, password)
    except Exception:
        return False


def generate_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def sha256_hex(value: str | bytes) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def hash_token(token: str) -> str:
    return sha256_hex(token)


def aesgcm() -> AESGCM:
    return AESGCM(normalize_key(settings.vault_encryption_key))


def encrypt_bytes(payload: bytes) -> tuple[bytes, bytes]:
    nonce = secrets.token_bytes(12)
    return nonce, aesgcm().encrypt(nonce, payload, None)


def decrypt_bytes(nonce: bytes, ciphertext: bytes) -> bytes:
    return aesgcm().decrypt(nonce, ciphertext, None)


def sign_jwt(payload: dict, expires_delta: timedelta) -> str:
    claims = payload | {"exp": utcnow() + expires_delta, "iat": utcnow()}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_jwt(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def create_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=window)


def build_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def ensure_https(scope: dict) -> bool:
    if settings.env != "production" or not settings.tls_enforce:
        return True
    scheme = scope.get("scheme", "")
    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    forwarded = headers.get("x-forwarded-proto", "")
    return scheme == "https" or forwarded == "https"


def is_private_or_local_ip(ip: str | None) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return False


SECRET_PATTERNS = {
    "password": re.compile(r"(?i)\bpassword\b\s*[:=]\s*[^\s,;]+"),
    "api_key": re.compile(r"(?i)\b(api[-_ ]?key|x-api-key)\b\s*[:=]\s*[^\s,;]+"),
    "token": re.compile(r"(?i)\b(token|bearer)\b\s*[:=]\s*[A-Za-z0-9._\-+/=]{8,}"),
    "secret": re.compile(r"(?i)\b(secret|client_secret|private_key)\b\s*[:=]\s*[^\s,;]+"),
    "aws_access_key": re.compile(r"AKIA[0-9A-Z]{16}"),
}


def scan_sensitive_text(text: str) -> list[dict]:
    findings: list[dict] = []
    for label, pattern in SECRET_PATTERNS.items():
        for match in pattern.finditer(text):
            findings.append({"type": label, "match": match.group(0)[:120]})
    return findings


def summarize_text(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    return compact[:limit] + ("..." if len(compact) > limit else "")


def detect_file_type(filename: str, content: bytes) -> str:
    ext = Path(filename).suffix.lower().lstrip(".")
    if content.startswith(b"%PDF"):
        return "pdf"
    if content.startswith(b"\x89PNG"):
        return "png"
    if content.startswith(b"PK\x03\x04"):
        return "archive"
    if content.startswith(b"GIF8"):
        return "gif"
    if content.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if b"\x00" not in content[:128]:
        return ext or "text"
    return ext or "binary"


def guess_category(file_type: str, findings: list[dict], suspicious: list[str]) -> str:
    if findings:
        return "sensitive"
    if suspicious:
        return "suspicious"
    if file_type in {"png", "jpeg", "gif"}:
        return "image"
    if file_type in {"pdf"}:
        return "document"
    if file_type in {"zip", "archive"}:
        return "archive"
    return "general"


def risk_level(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 50:
        return "warning"
    return "safe"


def clamp_score(value: int) -> int:
    return max(0, min(100, value))


def weighted_security_score(factors: Iterable[tuple[int, int]]) -> int:
    score = 100
    for weight, value in factors:
        score -= weight * value
    return clamp_score(score)


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return cleaned or "file"
