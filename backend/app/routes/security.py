from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.deps import current_user, db_dep
from app.services.security import dashboard_metrics, score_user

router = APIRouter(prefix="/api/security", tags=["security"])


@router.get("/overview")
def overview(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    score = score_user(db, user)
    db.commit()
    return {
        "security_score": score.score,
        "risk_level": score.risk_level,
        "recommendations": score.recommendations or [],
        "threat_history": score.threat_history or [],
    }


@router.get("/events", response_model=list[schemas.SecurityEventRead])
def events(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    rows = db.scalars(
        select(models.SecurityEvent).where(models.SecurityEvent.user_id == user.id).order_by(desc(models.SecurityEvent.created_at))
    ).all()
    return [
        schemas.SecurityEventRead(
            id=row.id,
            event_type=row.event_type,
            severity=row.severity,
            description=row.description,
            score_impact=row.score_impact,
            metadata=row.event_metadata,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/smart-dashboard", response_model=schemas.DashboardRead)
def smart_dashboard(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    payload = dashboard_metrics(db, user)
    db.commit()
    return schemas.DashboardRead(**payload)
