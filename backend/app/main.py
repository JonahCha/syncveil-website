from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.core.config import get_settings

settings = get_settings()


def _apply_schema_updates(engine):
    """
    Safely add any missing columns / tables using raw SQL.
    Uses IF NOT EXISTS so it is always safe to re-run.
    Bypasses Alembic entirely — no migration chain needed.
    """
    ddl_statements = [
        # Profile columns on users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name    VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone        VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS country      VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   VARCHAR(500)",

        # Connected accounts table
        """
        CREATE TABLE IF NOT EXISTS connected_accounts (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL REFERENCES users(id),
            provider          VARCHAR(50)  NOT NULL,
            provider_user_id  VARCHAR(255) NOT NULL,
            email             VARCHAR(255),
            display_name      VARCHAR(255),
            avatar_url        VARCHAR(500),
            access_token      TEXT,
            refresh_token     TEXT,
            connected_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            last_synced_at    TIMESTAMP
        )
        """,

        # Index (IF NOT EXISTS requires Postgres 9.5+, which Neon supports)
        """
        CREATE INDEX IF NOT EXISTS idx_connected_account_user
        ON connected_accounts (user_id, provider)
        """,
    ]

    from sqlalchemy import text
    with engine.begin() as conn:
        for stmt in ddl_statements:
            try:
                conn.execute(text(stmt.strip()))
            except Exception as e:
                # Log but don't crash — column/table may already exist
                print(f"⚠️  Schema update skipped ({e})")

    print("✅ Schema updates applied (profile columns + connected_accounts)")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        from app.db.session import engine
        from app.db.base import Base

        if engine is None:
            print("⚠️  DATABASE_URL not set — database features will not work")
        else:
            try:
                # Step 1: create any completely missing tables
                Base.metadata.create_all(bind=engine)
                print("✅ Database tables initialized successfully")

                # Step 2: add missing columns / new tables via raw SQL
                _apply_schema_updates(engine)

            except Exception as db_error:
                print(f"⚠️  Database initialization warning: {db_error}")
                print("🚀 App starting anyway — some features may not work")

    except Exception as e:
        print(f"⚠️  Unexpected error during initialization: {e}")

    yield


app = FastAPI(title="SyncVeil Backend", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins: list[str] = []

if settings.CORS_ORIGINS:
    origins.extend([o.rstrip("/") for o in settings.cors_origins_list if o != "*"])

if settings.FRONTEND_URL:
    origins.append(settings.FRONTEND_URL.rstrip("/"))

if settings.is_production and not origins:
    raise RuntimeError("❌ CORS misconfigured: no allowed origins in production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/auth")
app.include_router(dashboard_router)
