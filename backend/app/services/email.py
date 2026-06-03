from __future__ import annotations

import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

settings = get_settings()


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.email_enabled or not settings.smtp_from:
        return False

    if settings.brevo_api_key:
        payload = {
            "sender": {"email": settings.smtp_from, "name": "SyncVeil"},
            "to": [{"email": to_email}],
            "subject": subject,
            "textContent": body,
        }
        with httpx.Client(timeout=10) as client:
            response = client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": settings.brevo_api_key, "content-type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
        return True

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP("localhost") as client:
        client.send_message(message)
    return True
