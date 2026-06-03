from __future__ import annotations

from fastapi import APIRouter, Depends

from app import models, schemas
from app.deps import current_user, db_dep
from app.services.security import dashboard_metrics
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=schemas.DashboardRead)
def dashboard(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    payload = dashboard_metrics(db, user)
    db.commit()
    return schemas.DashboardRead(**payload)

@router.get("/public/security-snapshot")
def public_security_snapshot():
    return {
        "security_score": 84,
        "risk_level": "low",
        "recommendations": ["Connect an account to see personalized risk data."],
        "threat_history": [],
    }
