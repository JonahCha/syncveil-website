"""
Email Service - SendGrid Integration
CRITICAL: Real transactional emails only, no console logs in production
"""
import logging
from typing import Optional

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class EmailService:
    """Production email service using SendGrid"""
    
    def __init__(self):
        self.client = SendGridAPIClient(settings.SENDGRID_API_KEY)
        self.from_email = Email(settings.EMAIL_FROM, settings.EMAIL_FROM_NAME)
    
    def _send(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Send email via SendGrid.
        Returns True if sent successfully, False otherwise.
        NEVER fails silently in production.
        """
        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )
            
            response = self.client.send(message)
            
            if response.status_code >= 200 and response.status_code < 300:
                logger.info(f"Email sent successfully to {to_email}: {subject}")
                return True
            else:
                logger.error(f"Failed to send email to {to_email}. Status: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Email sending error to {to_email}: {str(e)}")
            if settings.is_production:
                # In production, we should alert ops team about email failures
                raise
            return False
    
    def send_verification_email(self, to_email: str, verification_token: str) -> bool:
        """Send email verification link"""
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ SyncVeil</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>Welcome to SyncVeil!</h2>
                <p>Please verify your email address to activate your account.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email</a>
                </div>
                <p style="color: #718096; font-size: 14px;">Link: {verification_url}</p>
                <p style="color: #a0aec0; font-size: 12px;">Expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.</p>
            </div>
        </body>
        </html>
        """
        
        return self._send(to_email, "Verify your SyncVeil account", html_content)
    
    def send_otp_email(self, to_email: str, otp_code: str) -> bool:
        """Send OTP code for login verification"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ SyncVeil</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>Your Login Code</h2>
                <p>Enter this code to complete your login:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">{otp_code}</span>
                </div>
                <p style="color: #e53e3e; font-size: 14px;">⚠️ This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
                <p style="color: #a0aec0; font-size: 12px;">Never share this code with anyone.</p>
            </div>
        </body>
        </html>
        """
        
        return self._send(to_email, f"Your SyncVeil login code: {otp_code}", html_content)
    
    def send_new_device_alert(self, to_email: str, device_info: str, ip_address: str) -> bool:
        """Send alert for new device login"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f59e0b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🔔 Security Alert</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>New Device Login</h2>
                <p>Your account was accessed from a new device:</p>
                <div style="background: #fef3c7; padding: 16px; margin: 24px 0;">
                    <p><strong>Device:</strong> {device_info}</p>
                    <p><strong>IP:</strong> {ip_address}</p>
                </div>
                <p style="color: #dc2626;">If this wasn't you, change your password immediately.</p>
            </div>
        </body>
        </html>
        """
        
        return self._send(to_email, "🔔 New device login", html_content)
    
    def send_password_change_alert(self, to_email: str) -> bool:
        """Send alert after password change"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #10b981; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🛡️ Password Changed</h1>
            </div>
            <div style="background: white; padding: 40px; border: 1px solid #e2e8f0;">
                <h2>Password Changed Successfully</h2>
                <p>Your SyncVeil password was changed.</p>
                <p style="color: #dc2626;">If you didn't make this change, contact support immediately.</p>
            </div>
        </body>
        </html>
        """
        
        return self._send(to_email, "Password changed", html_content)


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create email service singleton"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service