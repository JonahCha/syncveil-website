from __future__ import annotations

from datetime import timedelta
from hashlib import sha256
from pathlib import Path

from sqlalchemy.orm import Session

from app import models
from app.core.config import get_settings
from app.core.security import (
    detect_file_type,
    encrypt_bytes,
    guess_category,
    safe_filename,
    scan_sensitive_text,
    sha256_hex,
    summarize_text,
    utcnow,
)
from app.services.security import upload_risk_score

settings = get_settings()


def ensure_storage() -> Path:
    path = settings.storage_dir
    path.mkdir(parents=True, exist_ok=True)
    return path


def analyze_file_content(filename: str, content: bytes) -> dict:
    file_type = detect_file_type(filename, content)
    text = ""
    if file_type in {"text", "pdf"}:
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            text = ""
    else:
        text = content[:4096].decode("utf-8", errors="ignore")
    sensitive = scan_sensitive_text(text)
    suspicious = []
    lower = text.lower()
    if any(word in lower for word in ["malware", "ransomware", "phishing", "credential dump"]):
        suspicious.append("Suspicious threat keywords detected")
    if "drop table" in lower or "union select" in lower:
        suspicious.append("Potential SQL injection payload")
    if "eval(" in lower or "base64_decode" in lower:
        suspicious.append("Potentially unsafe code pattern detected")
    tags = [file_type]
    if sensitive:
        tags.append("sensitive-data")
    if suspicious:
        tags.append("suspicious")
    categories = [guess_category(file_type, sensitive, suspicious)]
    summary = summarize_text(text or f"{filename} ({len(content)} bytes) {file_type} file")
    risk_score = upload_risk_score(sensitive, suspicious, file_type)
    severity = "critical" if risk_score >= 80 else "warning" if risk_score >= 40 else "safe"
    return {
        "file_type": file_type,
        "tags": tags,
        "categories": categories,
        "summary": summary,
        "sensitive_findings": sensitive,
        "suspicious_findings": suspicious,
        "risk_score": risk_score,
        "severity": severity,
        "explanation": (
            "Sensitive information detected." if sensitive else "Suspicious content detected." if suspicious else "No obvious sensitive content found."
        ),
    }


def store_encrypted_file(
    db: Session,
    *,
    user: models.User,
    filename: str,
    content_type: str,
    content: bytes,
    ip_address: str | None = None,
) -> tuple[models.VaultFile, models.AIFileAnalysis, models.PrivacyScan]:
    storage_dir = ensure_storage()
    original_filename = safe_filename(filename)
    nonce, ciphertext = encrypt_bytes(content)
    digest = sha256(content).hexdigest()
    storage_filename = f"{digest[:16]}-{original_filename}.bin"
    storage_path = storage_dir / storage_filename
    storage_path.write_bytes(ciphertext)

    file_type_data = analyze_file_content(original_filename, content)
    file_row = models.VaultFile(
        user_id=user.id,
        original_filename=original_filename,
        storage_filename=storage_filename,
        storage_path=str(storage_path),
        content_type=content_type or "application/octet-stream",
        file_type=file_type_data["file_type"],
        size_bytes=len(content),
        sha256=digest,
        aes_nonce=nonce.hex(),
    )
    db.add(file_row)
    db.flush()

    analysis = models.AIFileAnalysis(
        file_id=file_row.id,
        file_type=file_type_data["file_type"],
        tags=file_type_data["tags"],
        categories=file_type_data["categories"],
        summary=file_type_data["summary"],
        sensitive_findings=file_type_data["sensitive_findings"],
        suspicious_findings=file_type_data["suspicious_findings"],
        risk_score=file_type_data["risk_score"],
        detected_sensitive=bool(file_type_data["sensitive_findings"]),
    )
    scan = models.PrivacyScan(
        file_id=file_row.id,
        severity=file_type_data["severity"],
        explanation=file_type_data["explanation"],
        matches=file_type_data["sensitive_findings"] or file_type_data["suspicious_findings"],
    )
    db.add_all([analysis, scan])
    return file_row, analysis, scan

