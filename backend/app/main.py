import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import models  # noqa: F401 (ensure models are registered)
from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.mongodb.routes import router as mongodb_router
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.core.config import get_settings


# ==========================
# SETTINGS
# ==========================
settings = get_settings()


# ==========================
# LIFESPAN (Startup / Shutdown)
# ==========================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate configuration (production-safe)
    # Settings already loaded globally to avoid repeated reads

    # MongoDB connection (non-blocking)
    if settings.MONGO_URI:
        print("🔌 Attempting MongoDB Atlas connection...")
        asyncio.create_task(try_connect_mongodb())
    else:
        if settings.is_production:
            raise RuntimeError("MONGO_URI is required in production")
        print("⚠️  MONGO_URI not set - MongoDB features disabled")

    yield

    # Shutdown cleanup
    try:
        await close_mongodb_connection()
    except Exception:
        pass


async def try_connect_mongodb():
    try:
        await connect_to_mongodb()
    except Exception as e:
        print(f"⚠️  MongoDB connection failed: {e}")
        print("   App will continue without MongoDB endpoints")


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

# 3. Local dev ONLY
if not settings.is_production:
    origins.append("http://localhost:5173")

# 4. Production safety check
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
app.include_router(mongodb_router, prefix="/api")
