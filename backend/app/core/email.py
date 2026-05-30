"""Email Service — Brevo Transactional Email API"""
import logging
from typing import Optional
import httpx
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

def _get_location(ip: str) -> str:
    """Get approximate location from IP — never raises."""
    if not ip or ip in ("127.0.0.1", "::1", "0.0.0.0"):
        return "Local / Unknown"
    try:
        r = httpx.get(f"http://ip-api.com/json/{ip}?fields=city,regionName,country,status", timeout=3)
        if r.is_success:
            d = r.json()
            if d.get("status") == "success":
                parts = [d.get("city",""), d.get("regionName",""), d.get("country","")]
                return ", ".join(p for p in parts if p) or "Unknown"
    except Exception:
        pass
    return "Unknown location"

def _parse_device(user_agent: str) -> str:
    if not user_agent:
        return "Unknown device"
    ua = user_agent.lower()
    browser = "Browser"
    os_name = "Unknown OS"
    if "chrome" in ua and "edg" not in ua: browser = "Chrome"
    elif "firefox" in ua: browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua: browser = "Safari"
    elif "edg" in ua: browser = "Edge"
    elif "opera" in ua or "opr" in ua: browser = "Opera"
    if "windows" in ua: os_name = "Windows"
    elif "mac os" in ua or "macos" in ua: os_name = "macOS"
    elif "iphone" in ua or "ipad" in ua: os_name = "iOS"
    elif "android" in ua: os_name = "Android"
    elif "linux" in ua: os_name = "Linux"
    return f"{browser} on {os_name}"

BRAND_HEADER = """
<div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;text-align:center;border-radius:12px 12px 0 0;">
  <span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🛡️ SyncVeil</span>
  <p style="color:#c7d2fe;font-size:13px;margin:4px 0 0;">Security-First Data Protection</p>
</div>
"""
BRAND_FOOTER = """
<div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
  <p style="color:#94a3b8;font-size:12px;margin:0;">SyncVeil &bull; End-to-End Encrypted &bull; {year}</p>
  <p style="color:#cbd5e1;font-size:11px;margin:4px 0 0;">Never share your codes. SyncVeil will never ask for your password.</p>
</div>
"""
def _footer(): 
    from datetime import datetime
    return BRAND_FOOTER.replace("{year}", str(datetime.utcnow().year))


class EmailService:
    def __init__(self):
        self.api_key      = settings.BREVO_API_KEY
        self.sender_email = settings.SMTP_FROM
        self.sender_name  = settings.EMAIL_FROM_NAME
        if settings.EMAIL_ENABLED:
            if not self.api_key or not self.sender_email:
                raise RuntimeError("EMAIL_ENABLED=true but BREVO_API_KEY or SMTP_FROM missing")

    def _send(self, to_email: str, subject: str, html: str) -> bool:
        if not settings.EMAIL_ENABLED:
            logger.info(f"Email disabled — skipped send to {to_email}: {subject}")
            return True
        payload = {
            "sender": {"email": self.sender_email, "name": self.sender_name},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html,
        }
        headers = {"api-key": self.api_key, "accept": "application/json", "content-type": "application/json"}
        try:
            with httpx.Client(timeout=10) as c:
                r = c.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
            if 200 <= r.status_code < 300:
                logger.info(f"Email sent → {to_email}: {subject}")
                return True
            logger.error(f"Brevo error {r.status_code}: {r.text[:300]}")
            raise RuntimeError(f"Brevo returned {r.status_code}")
        except Exception as e:
            logger.error(f"Email send error → {to_email}: {e}")
            raise

    def send_verification_email(self, to_email: str, otp: str) -> bool:
        html = f"""<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;margin:0;background:#f1f5f9;">
<div style="max-width:520px;margin:40px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  {BRAND_HEADER}
  <div style="background:#fff;padding:40px 36px;">
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Verify your email address</h2>
    <p style="color:#64748b;margin:0 0 28px;font-size:15px;">Enter this code in the app to verify your account.</p>
    <div style="background:#f0f4ff;border:2px dashed #818cf8;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-size:42px;font-weight:900;letter-spacing:14px;color:#4f46e5;font-family:monospace;">{otp}</span>
    </div>
    <p style="color:#ef4444;font-size:13px;margin:0 0 8px;">⏱ Expires in {settings.OTP_EXPIRE_MINUTES} minutes</p>
    <p style="color:#94a3b8;font-size:12px;margin:0;">If you didn't create a SyncVeil account, ignore this email.</p>
  </div>
  {_footer()}
</div></body></html>"""
        return self._send(to_email, "Verify your SyncVeil account", html)

    def send_otp_email(self, to_email: str, otp: str) -> bool:
        html = f"""<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;margin:0;background:#f1f5f9;">
<div style="max-width:520px;margin:40px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  {BRAND_HEADER}
  <div style="background:#fff;padding:40px 36px;">
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Your sign-in code</h2>
    <p style="color:#64748b;margin:0 0 28px;">Use this one-time code to complete your login.</p>
    <div style="background:#f0f4ff;border:2px dashed #818cf8;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-size:42px;font-weight:900;letter-spacing:14px;color:#4f46e5;font-family:monospace;">{otp}</span>
    </div>
    <p style="color:#ef4444;font-size:13px;margin:0 0 8px;">⏱ Expires in {settings.OTP_EXPIRE_MINUTES} minutes. Do not share this code.</p>
  </div>
  {_footer()}
</div></body></html>"""
        return self._send(to_email, f"SyncVeil sign-in code: {otp}", html)

    def send_password_reset_email(self, to_email: str, otp: str) -> bool:
        html = f"""<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;margin:0;background:#f1f5f9;">
<div style="max-width:520px;margin:40px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  {BRAND_HEADER}
  <div style="background:#fff;padding:40px 36px;">
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Reset your password</h2>
    <p style="color:#64748b;margin:0 0 28px;">Enter this code to reset your SyncVeil password.</p>
    <div style="background:#fff7ed;border:2px dashed #f97316;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-size:42px;font-weight:900;letter-spacing:14px;color:#ea580c;font-family:monospace;">{otp}</span>
    </div>
    <p style="color:#ef4444;font-size:13px;margin:0 0 8px;">⏱ Expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
    <p style="color:#94a3b8;font-size:12px;margin:0;">If you didn't request this, your password is safe — ignore this email.</p>
  </div>
  {_footer()}
</div></body></html>"""
        return self._send(to_email, "Reset your SyncVeil password", html)

    def send_login_notification(self, to_email: str, *, ip: str, user_agent: str, timestamp: str) -> bool:
        device   = _parse_device(user_agent)
        location = _get_location(ip)
        html = f"""<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;margin:0;background:#f1f5f9;">
<div style="max-width:520px;margin:40px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  {BRAND_HEADER}
  <div style="background:#fff;padding:40px 36px;">
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">New sign-in to your account</h2>
    <p style="color:#64748b;margin:0 0 24px;">A new sign-in was detected on your SyncVeil account.</p>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f8fafc;">
        <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">🖥️ Device</td>
        <td style="padding:12px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">{device}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">📍 Location</td>
        <td style="padding:12px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">{location}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">🌐 IP Address</td>
        <td style="padding:12px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">{ip}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:600;">🕐 Time</td>
        <td style="padding:12px 16px;font-size:14px;color:#1e293b;">{timestamp} UTC</td>
      </tr>
    </table>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
      <p style="color:#dc2626;font-size:13px;font-weight:600;margin:0 0 4px;">⚠️ Not you?</p>
      <p style="color:#7f1d1d;font-size:13px;margin:0;">Change your password immediately and contact support at customercare@syncveil.software</p>
    </div>
  </div>
  {_footer()}
</div></body></html>"""
        return self._send(to_email, "New sign-in to your SyncVeil account", html)

    def send_new_device_alert(self, to_email: str, device_info: str, ip_address: str) -> bool:
        return self.send_login_notification(to_email, ip=ip_address, user_agent=device_info, timestamp="recently")


_svc: Optional[EmailService] = None

def get_email_service() -> EmailService:
    global _svc
    if _svc is None:
        _svc = EmailService()
    return _svc
