from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.core.security import ensure_https
from app.routes.auth import router as auth_router
from app.routes.dashboard import router as dashboard_router
from app.routes.devices import router as devices_router
from app.routes.files import router as vault_router
from app.routes.public import router as public_router
from app.routes.security import router as security_router

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if settings.tls_enforce and settings.env == "production" and not ensure_https(request.scope):
            return JSONResponse({"detail": "HTTPS required"}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "script-src 'self'; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'"
        )
        if settings.env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response


class SimpleRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.window_seconds = 60
        self.buckets: dict[str, list[float]] = defaultdict(list)
        self.limits = {
            "/auth/login": 20,
            "/auth/signup": 10,
            "/auth/forgot-password": 10,
            "/auth/reset-password": 10,
            "/auth/resend-verification": 10,
            "/auth/oauth": 30,
            "/api/vault/upload": 20,
        }

    async def dispatch(self, request: Request, call_next):
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return await call_next(request)
        path = request.url.path
        limit = next((value for route, value in self.limits.items() if path.startswith(route)), 120)
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        key = f"{ip}:{path}"
        now = time.time()
        window = [stamp for stamp in self.buckets[key] if now - stamp < self.window_seconds]
        if len(window) >= limit:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
        window.append(now)
        self.buckets[key] = window
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SyncVeil Security Platform",
    version="2.0.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SimpleRateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method",
    ],
    expose_headers=["Content-Length", "X-CSRF-Token"],
    max_age=600,
)

app.include_router(public_router)
app.include_router(auth_router)
app.include_router(vault_router)
app.include_router(security_router)
app.include_router(dashboard_router)
app.include_router(devices_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


def run(host: str = "0.0.0.0", port: int = 8000) -> None:
    try:
        import uvicorn
    except ImportError:
        raise RuntimeError("uvicorn is required to run the backend server")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
