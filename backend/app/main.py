from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.core.config import get_settings


# ==========================
# SETTINGS
# ==========================
settings = get_settings()


# ==========================
# LIFESPAN (Startup / Shutdown)
# ==========================
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Validate configuration (production-safe)
    # Settings already loaded globally to avoid repeated reads

    # Initialize database connection and create tables
    try:
        from app.db.session import engine
        from app.db.base import Base
        
        if engine is None:
            print("⚠️  DATABASE_URL not set — skipping database initialization")
            if settings.is_production:
                raise RuntimeError(
                    "DATABASE_URL is required in production. "
                    "Add it as an environment variable in Render."
                )
        else:
            # Create all tables (safe idempotent operation)
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables initialized successfully")
            
            # Attempt Alembic migrations if available
            try:
                from alembic.config import Config
                from alembic.command import upgrade
                import os
                
                backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                alembic_ini_path = os.path.join(backend_dir, 'alembic.ini')
                
                if os.path.exists(alembic_ini_path):
                    alembic_cfg = Config(alembic_ini_path)
                    alembic_cfg.set_main_option('sqlalchemy.url', os.environ.get('DATABASE_URL', ''))
                    upgrade(alembic_cfg, 'head')
                    print("✅ Database migrations applied successfully")
            except Exception as migration_error:
                print(f"⚠️  Alembic migrations skipped: {migration_error}")
                # Don't fail - tables are already created
                
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        if settings.is_production:
            raise RuntimeError(f"Database initialization failed: {e}")

    yield


# ==========================
# APP INITIALIZATION
# ==========================
app = FastAPI(
    title="SyncVeil Backend",
    lifespan=lifespan,
)


# ==========================
# CORS (STRICT & CORRECT)
# ==========================
origins: list[str] = []

# 1. Explicit CORS_ORIGINS (comma-separated)
if settings.CORS_ORIGINS:
    origins.extend(
        [o.rstrip("/") for o in settings.cors_origins_list if o != "*"]
    )

# 2. Explicit FRONTEND_URL
if settings.FRONTEND_URL:
    origins.append(settings.FRONTEND_URL.rstrip("/"))

# 3. Safety check
if settings.is_production and not origins:
    raise RuntimeError(
        "❌ CORS misconfigured: no allowed origins in production"
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================
# HEALTH CHECK
# ==========================
@app.get("/health")
def health():
    return {"status": "ok"}


# ==========================
# API ROUTES
# ==========================
app.include_router(auth_router, prefix="/auth")
app.include_router(dashboard_router)
