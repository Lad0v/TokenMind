"""Tests for app/services/otp_sender.py (MSG91 SMS integration).

NOTE: SMS OTP is currently a STUB (NotImplementedError).
These tests are placeholders for future MSG91 integration.

Uses respx to mock httpx calls to MSG91 API.
"""

from __future__ import annotations

import httpx
import pytest
import respx

from app.services.otp_sender import send_sms_otp, resend_sms_otp

# ---------------------------------------------------------------------------
# Fixtures / constants
# ---------------------------------------------------------------------------

MSG91_BASE = "https://api.msg91.com/api/v5/otp"
VALID_PHONE = "+77001234567"
VALID_CODE = "123456"
VALID_PURPOSE = "register"


# ---------------------------------------------------------------------------
# send_sms_otp — currently STUB
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_send_sms_otp_is_stub():
    """SMS OTP is not yet implemented — NotImplementedError expected."""
    with pytest.raises(NotImplementedError):
        send_sms_otp(VALID_PHONE, VALID_CODE, VALID_PURPOSE)


# ---------------------------------------------------------------------------
# resend_sms_otp — currently STUB
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resend_sms_otp_is_stub():
    """SMS OTP resend is not yet implemented — NotImplementedError expected."""
    with pytest.raises(NotImplementedError):
        await resend_sms_otp(VALID_PHONE, via="text")


# ---------------------------------------------------------------------------
# TODO: Enable these tests after MSG91 integration
# ---------------------------------------------------------------------------
#
# @pytest.mark.asyncio
# async def test_send_sms_otp_success(respx_mock):
#     """MSG91 returns {\"type\": \"success\"} — no exception raised."""
#     respx_mock.post(MSG91_BASE).mock(
#         return_value=httpx.Response(200, json={"type": "success"})
#     )
#     await send_sms_otp(VALID_PHONE, VALID_CODE, VALID_PURPOSE)
#
# @pytest.mark.asyncio
# async def test_send_sms_otp_provider_error(respx_mock):
#     """MSG91 returns {\"type\": \"error\"} — RuntimeError raised."""
#     respx_mock.post(MSG91_BASE).mock(
#         return_value=httpx.Response(
#             200,
#             json={"type": "error", "message": "Invalid template"},
#         )
#     )
#     with pytest.raises(RuntimeError, match="MSG91 returned error"):
#         await send_sms_otp(VALID_PHONE, VALID_CODE, VALID_PURPOSE)
#
# @pytest.mark.asyncio
# async def test_send_sms_otp_http_401(respx_mock):
#     """MSG91 returns HTTP 401 — httpx.HTTPStatusError raised."""
#     respx_mock.post(MSG91_BASE).mock(
#         return_value=httpx.Response(401, json={"type": "error"})
#     )
#     with pytest.raises(httpx.HTTPStatusError):
#         await send_sms_otp(VALID_PHONE, VALID_CODE, VALID_PURPOSE)
#
# @pytest.mark.asyncio
# async def test_resend_sms_otp_text(respx_mock):
#     """Retry endpoint returns 200 with type=success for via='text'."""
#     respx_mock.get(f"{MSG91_BASE}/retry").mock(
#         return_value=httpx.Response(200, json={"type": "success"})
#     )
#     await resend_sms_otp(VALID_PHONE, via="text")
#     request = respx_mock.calls.last.request
#     assert request.url.params["retrytype"] == "text"
#
# @pytest.mark.asyncio
# async def test_resend_sms_otp_voice(respx_mock):
#     """Retry endpoint returns 200 with type=success for via='voice'."""
#     respx_mock.get(f"{MSG91_BASE}/retry").mock(
#         return_value=httpx.Response(200, json={"type": "success"})
#     )
#     await resend_sms_otp(VALID_PHONE, via="voice")
#     request = respx_mock.calls.last.request
#     assert request.url.params["retrytype"] == "voice"
