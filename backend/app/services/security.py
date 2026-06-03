from __future__ import annotations

from collections import Counter
from datetime import timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app import models
from app.core.security import clamp_score, risk_level, utcnow, weighted_security_score


def _events_as_dict(events: list[models.SecurityEvent]) -> list[dict]:
    return [
        {
            "event_type": event.event_type,
            "severity": event.severity,
            "description": event.description,
            "score_impact": event.score_impact,
            "created_at": event.created_at.isoformat() if event.created_at else None,
            "metadata": event.event_metadata or {},
        }
        for event in events
    ]


def score_user(db: Session, user: models.User) -> models.SecurityScore:
    devices = list(db.scalars(select(models.UserDevice).where(models.UserDevice.user_id == user.id)).all())
    sessions = list(
        db.scalars(
            select(models.RefreshSession).where(
                models.RefreshSession.user_id == user.id,
                models.RefreshSession.revoked_at.is_(None),
                models.RefreshSession.expires_at > utcnow(),
            )
        ).all()
    )
    events = list(
        db.scalars(
            select(models.SecurityEvent)
            .where(models.SecurityEvent.user_id == user.id)
            .order_by(desc(models.SecurityEvent.created_at))
            .limit(20)
        ).all()
    )
    file_scans = list(
        db.scalars(
            select(models.PrivacyScan)
            .join(models.VaultFile)
            .where(models.VaultFile.user_id == user.id)
            .order_by(desc(models.PrivacyScan.created_at))
            .limit(20)
        ).all()
    )

    suspicious_devices = sum(1 for device in devices if device.risk_score >= 70 or device.revoked_at)
    risky_events = sum(1 for event in events if event.severity in {"high", "critical"})
    risky_scans = sum(1 for scan in file_scans if scan.severity in {"warning", "critical"})
    unfinished_sessions = len(sessions)
    score = weighted_security_score(
        [
            (8, suspicious_devices),
            (6, risky_events),
            (5, risky_scans),
            (2, max(0, unfinished_sessions - 1)),
        ]
    )
    recommendations = []
    if suspicious_devices:
        recommendations.append("Review and revoke untrusted devices.")
    if risky_scans:
        recommendations.append("Inspect uploaded files flagged by privacy guardian.")
    if not user.email_verified:
        recommendations.append("Verify the account email to unlock full trust.")
    if not user.mfa_enabled:
        recommendations.append("Enable MFA for stronger sign-in protection.")
    if not recommendations:
        recommendations.append("Security posture looks healthy. Keep monitoring new events.")

    history = _events_as_dict(events)
    record = models.SecurityScore(
        user_id=user.id,
        score=score,
        risk_level=risk_level(100 - score),
        recommendations=recommendations,
        threat_history=history,
        computed_at=utcnow(),
    )
    db.add(record)
    return record


def device_risk(user: models.User, device: models.UserDevice) -> int:
    risk = device.risk_score
    if not user.email_verified:
        risk += 5
    if not user.mfa_enabled:
        risk += 10
    if device.revoked_at:
        risk += 30
    return clamp_score(risk)


def login_anomaly_risk(
    *,
    user: models.User | None,
    device: models.UserDevice | None,
    ip_address: str | None,
    user_agent: str | None,
    failed_attempts: int,
) -> tuple[int, list[str]]:
    risk = 10
    notes: list[str] = []
    if user is None:
        return 90, ["Unknown user login attempt."]
    if device is None:
        risk += 35
        notes.append("New device detected.")
    elif device.trust_level != "trusted":
        risk += 15
        notes.append("Device is not fully trusted.")
    if failed_attempts >= 3:
        risk += 25
        notes.append("Multiple failed attempts before successful login.")
    if ip_address and device and device.ip_address and device.ip_address != ip_address:
        risk += 15
        notes.append("Login from a different IP than the remembered device.")
    if user_agent and device and device.user_agent and device.user_agent != user_agent:
        risk += 10
        notes.append("User agent changed.")
    return clamp_score(risk), notes


def upload_risk_score(text_findings: list[dict], suspicious: list[str], file_type: str) -> int:
    base = 8 if file_type in {"pdf", "text"} else 12
    return clamp_score(base + len(text_findings) * 20 + len(suspicious) * 10)


def dashboard_metrics(db: Session, user: models.User) -> dict:
    uploads = list(
        db.execute(
            select(func.date(models.VaultFile.created_at), func.count(models.VaultFile.id))
            .where(models.VaultFile.user_id == user.id)
            .group_by(func.date(models.VaultFile.created_at))
            .order_by(func.date(models.VaultFile.created_at))
        ).all()
    )
    storage = list(
        db.execute(
            select(models.VaultFile.file_type, func.sum(models.VaultFile.size_bytes))
            .where(models.VaultFile.user_id == user.id)
            .group_by(models.VaultFile.file_type)
        ).all()
    )
    activity = list(
        db.execute(
            select(func.date(models.SecurityEvent.created_at), func.count(models.SecurityEvent.id))
            .where(models.SecurityEvent.user_id == user.id)
            .group_by(func.date(models.SecurityEvent.created_at))
            .order_by(func.date(models.SecurityEvent.created_at))
        ).all()
    )
    sharing = list(
        db.execute(
            select(func.date(models.AuditLog.created_at), func.count(models.AuditLog.id))
            .where(models.AuditLog.actor_user_id == user.id, models.AuditLog.action.like("%share%"))
            .group_by(func.date(models.AuditLog.created_at))
            .order_by(func.date(models.AuditLog.created_at))
        ).all()
    )
    events = list(
        db.scalars(
            select(models.SecurityEvent)
            .where(models.SecurityEvent.user_id == user.id)
            .order_by(desc(models.SecurityEvent.created_at))
            .limit(20)
        ).all()
    )
    latest_score = db.scalar(
        select(models.SecurityScore)
        .where(models.SecurityScore.user_id == user.id)
        .order_by(desc(models.SecurityScore.computed_at))
        .limit(1)
    )
    if latest_score is None:
        latest_score = score_user(db, user)
    return {
        "security_score": latest_score.score,
        "risk_level": latest_score.risk_level,
        "recommendations": latest_score.recommendations or [],
        "threat_history": latest_score.threat_history or [],
        "upload_activity": [{"date": str(row[0]), "count": row[1]} for row in uploads],
        "storage_usage": [{"label": row[0], "value": int(row[1] or 0)} for row in storage],
        "user_activity": [{"date": str(row[0]), "count": row[1]} for row in activity],
        "sharing_activity": [{"date": str(row[0]), "count": row[1]} for row in sharing],
        "security_events": [
            {
                "event_type": item.event_type,
                "severity": item.severity,
                "description": item.description,
                "created_at": item.created_at.isoformat(),
            }
            for item in events
        ],
    }
