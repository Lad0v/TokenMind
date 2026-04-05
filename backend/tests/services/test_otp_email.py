"""Tests for app/services/otp_sender.py — Email SMTP delivery.

Uses unittest.mock to patch smtplib.SMTP and simulate:
- Successful email delivery
- SMTP connection failure
- SMTP authentication failure
- General SMTP exception
"""

from __future__ import annotations

import smtplib
from unittest.mock import MagicMock, patch

import pytest

from app.services.otp_sender import send_email_otp


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_EMAIL = "test@example.com"
VALID_CODE = "654321"
VALID_PURPOSE = "register"


# ---------------------------------------------------------------------------
# 1. Successful email delivery
# ---------------------------------------------------------------------------


def test_send_email_otp_success():
    """SMTP sends email successfully — no exception raised."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

        # Mock settings to have credentials
        with patch("app.services.otp_sender.settings") as mock_settings:
            mock_settings.SMTP_HOST = "smtp.gmail.com"
            mock_settings.SMTP_PORT = 587
            mock_settings.SMTP_USER = "test@gmail.com"
            mock_settings.SMTP_PASSWORD = "password"

            send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)

        # Verify SMTP was called
        mock_smtp_class.assert_called_once()
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once()
        mock_server.sendmail.assert_called_once()

        # Verify email content
        args = mock_server.sendmail.call_args[0]
        assert args[1] == [VALID_EMAIL]
        assert VALID_CODE in args[2]  # body contains OTP


def test_send_email_otp_without_credentials():
    """SMTP works without login (local server)."""
    with patch("app.services.otp_sender.settings") as mock_settings, \
         patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        
        mock_settings.SMTP_HOST = "localhost"
        mock_settings.SMTP_PORT = 1025
        mock_settings.SMTP_USER = ""
        mock_settings.SMTP_PASSWORD = ""

        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

        send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)

        # Login not called when credentials missing
        mock_server.login.assert_not_called()
        mock_server.sendmail.assert_called_once()


# ---------------------------------------------------------------------------
# 2. SMTP failures
# ---------------------------------------------------------------------------


def test_send_email_otp_smtp_connection_error():
    """SMTP connection refused — RuntimeError raised."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_smtp_class.side_effect = smtplib.SMTPConnectError(
            code=421, msg="Connection refused"
        )

        with pytest.raises(RuntimeError, match="EMAIL_SEND_FAILED"):
            send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)


def test_send_email_otp_smtp_authentication_error():
    """SMTP login failed — RuntimeError raised."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)
        mock_server.login.side_effect = smtplib.SMTPAuthenticationError(
            code=535, msg="Authentication failed"
        )

        with patch("app.services.otp_sender.settings") as mock_settings:
            mock_settings.SMTP_HOST = "smtp.gmail.com"
            mock_settings.SMTP_PORT = 587
            mock_settings.SMTP_USER = "test@gmail.com"
            mock_settings.SMTP_PASSWORD = "wrongpassword"

            with pytest.raises(RuntimeError, match="EMAIL_SEND_FAILED"):
                send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)


def test_send_email_otp_general_smtp_exception():
    """Any unexpected SMTP error — RuntimeError raised."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)
        mock_server.sendmail.side_effect = smtplib.SMTPRecipientsRefused(
            recipients={VALID_EMAIL: (550, "User unknown")}
        )

        with pytest.raises(RuntimeError, match="EMAIL_SEND_FAILED"):
            send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)


def test_send_email_otp_non_smtp_exception():
    """Non-SMTP exception (e.g. network error) — RuntimeError raised."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_smtp_class.side_effect = OSError("Network unreachable")

        with pytest.raises(RuntimeError, match="EMAIL_SEND_FAILED"):
            send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)


# ---------------------------------------------------------------------------
# 3. Email content validation
# ---------------------------------------------------------------------------


def test_send_email_contains_otp_code():
    """Email body contains the OTP code."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

        with patch("app.services.otp_sender.settings") as mock_settings:
            mock_settings.SMTP_HOST = "smtp.gmail.com"
            mock_settings.SMTP_PORT = 587
            mock_settings.SMTP_USER = "test@gmail.com"
            mock_settings.SMTP_PASSWORD = "password"

            send_email_otp(VALID_EMAIL, VALID_CODE, VALID_PURPOSE)

        sendmail_args = mock_server.sendmail.call_args[0]
        email_body = sendmail_args[2]
        assert VALID_CODE in email_body


def test_send_email_subject_contains_purpose():
    """Email subject contains the purpose."""
    with patch("app.services.otp_sender.smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

        with patch("app.services.otp_sender.settings") as mock_settings:
            mock_settings.SMTP_HOST = "smtp.gmail.com"
            mock_settings.SMTP_PORT = 587
            mock_settings.SMTP_USER = "test@gmail.com"
            mock_settings.SMTP_PASSWORD = "password"

            send_email_otp(VALID_EMAIL, VALID_CODE, "password_reset")

        sendmail_args = mock_server.sendmail.call_args[0]
        email_headers = sendmail_args[2]
        # Subject is MIME-encoded: "password_reset" → "password=5Freset" in quoted-printable
        # Check for the encoded version (case-insensitive)
        assert "password=5freset" in email_headers.lower()
