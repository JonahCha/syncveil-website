"""
Core configuration module - Environment-based settings
CRITICAL: Never expose secrets or allow hardcoded values in production
"""
import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "syncveil"
    
    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Email (SendGrid)
    SENDGRID_API_KEY: str
    EMAIL_FROM: str
    EMAIL_FROM_NAME: str = "SyncVeil"
    
    # OTP
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    
    # Email Verification
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    EMAIL_VERIFICATION_REQUIRED: bool = True
    
    # Security - Argon2
    PASSWORD_HASH_TIME_COST: int = 2
    PASSWORD_HASH_MEMORY_COST: int = 65536
    PASSWORD_HASH_PARALLELISM: int = 1
    
    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_OTP: str = "3/minute"
    RATE_LIMIT_SIGNUP: str = "2/minute"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5500"
    
    # Admin
    INITIAL_ADMIN_EMAIL: str = "admin@syncveil.com"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/syncveil.log"
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5500"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    def validate_production_settings(self):
        """Validate critical settings for production"""
        if not self.is_production:
            return
        
        errors = []
        
        # Check JWT secret is not default
        if "dev-secret" in self.JWT_SECRET.lower() or len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be a strong random key in production")
        
        # Check database is not SQLite
        if "sqlite" in self.DATABASE_URL.lower():
            errors.append("SQLite is not allowed in production, use PostgreSQL")
        
        # Check email is configured
        if not self.SENDGRID_API_KEY or "YOUR" in self.SENDGRID_API_KEY:
            errors.append("SENDGRID_API_KEY must be configured in production")
        
        # Check HTTPS frontend
        if not self.FRONTEND_URL.startswith("https://"):
            errors.append("FRONTEND_URL must use HTTPS in production")
        
        if errors:
            raise ValueError(f"Production validation failed:\n" + "\n".join(f"- {e}" for e in errors))
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    settings = Settings()
    settings.validate_production_settings()
    return settings
