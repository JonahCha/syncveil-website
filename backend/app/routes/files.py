from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.deps import current_user, db_dep
from app.services.audit import audit_log
from app.services.files import store_encrypted_file

router = APIRouter(prefix="/api/vault", tags=["vault"])


@router.post("/upload", response_model=schemas.FileAnalysisRead)
async def upload_file(
    file: UploadFile = File(...),
    user: models.User = Depends(current_user),
    db: Session = Depends(db_dep),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    vault_file, analysis, scan = store_encrypted_file(
        db,
        user=user,
        filename=file.filename or "upload.bin",
        content_type=file.content_type or "application/octet-stream",
        content=content,
    )
    audit_log(
        db,
        actor_user_id=user.id,
        action="vault.upload",
        resource_type="file",
        resource_id=str(vault_file.id),
        metadata={"file_type": vault_file.file_type, "risk_score": analysis.risk_score},
    )
    db.commit()
    return schemas.FileAnalysisRead(
        id=analysis.id,
        file_id=analysis.file_id,
        file_type=analysis.file_type,
        tags=analysis.tags,
        categories=analysis.categories,
        summary=analysis.summary,
        sensitive_findings=analysis.sensitive_findings,
        suspicious_findings=analysis.suspicious_findings,
        risk_score=analysis.risk_score,
        detected_sensitive=analysis.detected_sensitive,
    )


@router.get("/files")
def list_files(user: models.User = Depends(current_user), db: Session = Depends(db_dep)):
    rows = db.scalars(
        select(models.VaultFile).where(models.VaultFile.user_id == user.id).order_by(desc(models.VaultFile.created_at))
    ).all()
    return [
        {
            "id": row.id,
            "name": row.original_filename,
            "type": row.file_type,
            "size_bytes": row.size_bytes,
            "created_at": row.created_at,
            "analysis": row.analysis.summary if row.analysis else None,
            "risk_score": row.analysis.risk_score if row.analysis else 0,
        }
        for row in rows
    ]

