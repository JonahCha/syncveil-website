from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.core.config import get_settings

settings = get_settings()

def _apply_schema(engine):
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name    VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone        VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS country      VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   VARCHAR(500)",
        "ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location VARCHAR(255)",
        """CREATE TABLE IF NOT EXISTS connected_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            provider VARCHAR(50) NOT NULL,
            provider_user_id VARCHAR(255) NOT NULL,
            email VARCHAR(255), display_name VARCHAR(255),
            avatar_url VARCHAR(500), access_token TEXT, refresh_token TEXT,
            connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
            last_synced_at TIMESTAMP)""",
        "CREATE INDEX IF NOT EXISTS idx_connected_account_user ON connected_accounts(user_id, provider)",
        """CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            otp_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            used_at TIMESTAMP, ip_address VARCHAR(45))""",
        "CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id, used)",
        """CREATE TABLE IF NOT EXISTS vault_files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            file_name VARCHAR(500) NOT NULL,
            content_type VARCHAR(200) NOT NULL DEFAULT 'application/octet-stream',
            size_bytes BIGINT NOT NULL DEFAULT 0,
            sha256 VARCHAR(64),
            encrypted_data BYTEA NOT NULL,
            nonce BYTEA NOT NULL,
            uploaded_at TIMESTAMP NOT NULL DEFAULT NOW())""",
        "CREATE INDEX IF NOT EXISTS idx_vault_user ON vault_files(user_id, uploaded_at)",
    ]
    with engine.begin() as conn:
        for s in stmts:
            try: conn.execute(text(s.strip()))
            except Exception as e: print(f"⚠ schema: {e}")
    print("✅ Schema up to date")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        from app.db.session import engine
        from app.db.base import Base
        if engine is None:
            print("⚠ DATABASE_URL not set")
        else:
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables initialized successfully")
            _apply_schema(engine)
    except Exception as e:
        print(f"⚠ DB init warning: {e}")
    yield

app = FastAPI(title="SyncVeil API", lifespan=lifespan)

origins = list({o.rstrip("/") for o in settings.cors_origins_list if o != "*"} | {settings.FRONTEND_URL.rstrip("/")} - {""})
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health(): return {"status": "ok"}

app.include_router(auth_router, prefix="/auth")
app.include_router(dashboard_router)
