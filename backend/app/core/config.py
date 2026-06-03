from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["development", "test", "production"] = Field(default="development", alias="ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    database_url: str = Field(default="sqlite:///./syncveil.db", alias="DATABASE_URL")
    frontend_url: str = Field(default="http://localhost:5173", alias="FRONTEND_URL")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )
    jwt_secret: str = Field(default="dev-only-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=30, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    vault_encryption_key: str = Field(default="dev-only-change-me-too", alias="VAULT_ENCRYPTION_KEY")
    vault_storage_dir: str = Field(default="./storage/vault", alias="VAULT_STORAGE_DIR")
    csrf_cookie_name: str = Field(default="syncveil_csrf", alias="CSRF_COOKIE_NAME")
    refresh_cookie_name: str = Field(default="syncveil_refresh", alias="REFRESH_COOKIE_NAME")
    email_enabled: bool = Field(default=False, alias="EMAIL_ENABLED")
    email_verification_required: bool = Field(default=False, alias="EMAIL_VERIFICATION_REQUIRED")
    smtp_from: str = Field(default="", alias="SMTP_FROM")
    brevo_api_key: str = Field(default="", alias="BREVO_API_KEY")
    log_file: str = Field(default="logs/syncveil.log", alias="LOG_FILE")
    redis_url: str = Field(default="", alias="REDIS_URL")
    security_events_days: int = Field(default=7, alias="SECURITY_EVENTS_DAYS")
    rate_limit_login: str = Field(default="5/minute", alias="RATE_LIMIT_LOGIN")
    rate_limit_signup: str = Field(default="2/minute", alias="RATE_LIMIT_SIGNUP")
    rate_limit_otp: str = Field(default="3/minute", alias="RATE_LIMIT_OTP")
    rate_limit_default: str = Field(default="120/minute", alias="RATE_LIMIT_DEFAULT")
    oauth_google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    oauth_microsoft_client_id: str = Field(default="", alias="MICROSOFT_CLIENT_ID")
    oauth_apple_client_id: str = Field(default="", alias="APPLE_CLIENT_ID")
    oauth_redirect_base: str = Field(default="http://localhost:5173/auth/callback", alias="OAUTH_REDIRECT_BASE")
    tls_enforce: bool = Field(default=True, alias="TLS_ENFORCE")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def storage_dir(self) -> Path:
        return Path(self.vault_storage_dir)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

