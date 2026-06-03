from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app import models
from app.core.security import utcnow


def audit_log(
    db: Session,
    *,
    actor_user_id: int | None,
    action: str,
    status: str = "ok",
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    device_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> models.AuditLog:
    entry = models.AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        status=status,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        device_id=device_id,
        event_metadata=metadata,
        created_at=utcnow(),
    )
    db.add(entry)
    return entry
