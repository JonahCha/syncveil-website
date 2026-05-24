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

    # Create SQL tables if not already present (safety net for first deploy)
    try:
        from app.db.session import engine
        if engine is not None:
            from app.db.base import Base
            Base.metadata.create_all(bind=engine)
            print("✅ SQL tables ensured (created if missing)")
        else:
            print("⚠️  DATABASE_URL not set — skipping SQL table creation")
            if settings.is_production:
                raise RuntimeError(
                    "DATABASE_URL is required in production. "
                    "Add it as an environment variable in Render."
                )
    except RuntimeError:
        raise
    except Exception as e:
        print(f"⚠️  SQL table creation check failed: {e}")
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
