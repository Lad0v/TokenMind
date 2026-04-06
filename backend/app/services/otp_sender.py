"""SMS and email OTP delivery services.

Email delivery uses SMTP via environment variables.
SMS delivery is a STUB for future provider integration.
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email_otp(to_email: str, code: str, purpose: str) -> None:
    """Send OTP via SMTP using environment variables.

    Args:
        to_email: Recipient email address.
        code: 6-digit OTP code.
        purpose: OTP purpose (register, login, password_reset).

    Raises:
        RuntimeError: With message "EMAIL_SEND_FAILED" on any smtplib exception.
    """
    smtp_host = settings.SMTP_HOST or "smtp.gmail.com"
    smtp_port = settings.SMTP_PORT or 587
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASSWORD

    subject = f"IPChain OTP – {purpose}"
    body = f"Your verification code: {code}\nExpires in 5 minutes."

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = to_email

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())
    except smtplib.SMTPException as exc:
        logger.error("SMTP error while sending OTP email: %s", exc)
        raise RuntimeError("EMAIL_SEND_FAILED") from exc
    except Exception as exc:
        logger.error("Unexpected error while sending OTP email: %s", exc)
        raise RuntimeError("EMAIL_SEND_FAILED") from exc


def send_sms_otp(to_phone: str, code: str, purpose: str) -> None:
    """Send OTP via SMS provider (STUB).

    TODO: integrate SMS provider (Firebase Auth / MSG91 / Vonage)

    Args:
        to_phone: Phone number in E.164 format.
        code: 6-digit OTP code.
        purpose: OTP purpose.

    Raises:
        NotImplementedError: Always, with message about SMS not being configured.
    """
    raise NotImplementedError(
        "SMS OTP delivery is not yet configured. Use email identifier for now."
    )
