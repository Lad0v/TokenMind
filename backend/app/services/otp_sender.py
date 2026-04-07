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


def _string_or_default(value: object, default: str) -> str:
    if isinstance(value, str) and value.strip():
        return value
    return default


def _should_log_dev_otp(smtp_host: str, smtp_user: str, smtp_pass: str) -> bool:
    local_hosts = {"localhost", "127.0.0.1", "mailhog", "smtp"}
    return not smtp_user and not smtp_pass and smtp_host not in local_hosts


def send_email_otp(to_email: str, code: str, purpose: str) -> None:
    """Send OTP via SMTP using environment variables.

    Args:
        to_email: Recipient email address.
        code: 6-digit OTP code.
        purpose: OTP purpose (register, login, password_reset).

    Raises:
        RuntimeError: With message "EMAIL_SEND_FAILED" on any smtplib exception.
    """
    smtp_host = _string_or_default(settings.SMTP_HOST, "smtp.gmail.com")
    smtp_port = settings.SMTP_PORT or 587
    smtp_user = _string_or_default(settings.SMTP_USER, "")
    smtp_pass = _string_or_default(settings.SMTP_PASSWORD, "")
    from_email = _string_or_default(
        settings.SMTP_FROM_EMAIL,
        smtp_user or "noreply@tokenmind.local",
    )

    if _should_log_dev_otp(smtp_host, smtp_user, smtp_pass):
        logger.warning(
            "SMTP credentials are not configured. OTP for %s (%s): %s",
            to_email,
            purpose,
            code,
        )
        return

    subject = f"IPChain OTP – {purpose}"
    body = f"Your verification code: {code}\nExpires in 5 minutes."

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, [to_email], msg.as_string())
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
