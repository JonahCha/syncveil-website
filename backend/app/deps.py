from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app import models
from app.core.database import get_db
from app.core.security import is_expired, verify_jwt
from app.services.auth import get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


def db_dep() -> Session:
    yield from get_db()


def get_token_from_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials
    if request.cookies.get("syncveil_access"):
        return request.cookies["syncveil_access"]
    return None


def current_user(
    request: Request,
    db: Session = Depends(db_dep),
    token: str | None = Depends(get_token_from_request),
) -> models.User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = verify_jwt(token)
        user_id = int(payload["sub"])
        session_id = int(payload.get("sid"))
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    session = db.get(models.RefreshSession, session_id)
    if (
        session is None
        or session.user_id != user.id
        or session.revoked_at is not None
        or is_expired(session.expires_at)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return user
