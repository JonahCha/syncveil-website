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
# CORS
# ==========================
base_origins = settings.cors_origins_list

if base_origins == ["*"]:
    allowed_origins = ["*"]
else:
    allowed_origins = set(base_origins)
    if settings.FRONTEND_URL:
        allowed_origins.add(settings.FRONTEND_URL.rstrip("/"))
    # Local development only - allows frontend dev server access
    allowed_origins.add("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
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
