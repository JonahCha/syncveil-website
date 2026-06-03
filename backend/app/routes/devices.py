from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.deps import current_user, db_dep

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=list[schemas.DeviceRead])
def list_devices(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    rows = db.scalars(select(models.UserDevice).where(models.UserDevice.user_id == user.id).order_by(models.UserDevice.last_seen_at.desc())).all()
    return [
        schemas.DeviceRead(
            id=row.id,
            name=row.name,
            fingerprint=row.fingerprint,
            trust_level=row.trust_level,
            risk_score=row.risk_score,
            last_seen_at=row.last_seen_at,
            revoked_at=row.revoked_at,
        )
        for row in rows
    ]


@router.post("/{device_id}/trust")
def trust_device(device_id: int, user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    device = db.get(models.UserDevice, device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    device.trust_level = "trusted"
    device.risk_score = max(0, device.risk_score - 20)
    db.commit()
    return {"message": "Device trusted"}


@router.post("/{device_id}/revoke")
def revoke_device(device_id: int, user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    device = db.get(models.UserDevice, device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Device not found")
    device.revoked_at = device.revoked_at or device.updated_at
    device.trust_level = "revoked"
    db.commit()
    return {"message": "Device revoked"}
