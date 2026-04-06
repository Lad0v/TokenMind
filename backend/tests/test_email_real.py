# test_email_real.py
import os
import sys
import pytest
from dotenv import load_dotenv
from pathlib import Path

# Загружаем .env из корня проекта до импорта settings
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, "..")

from app.services.otp_sender import send_email_otp

TO_EMAIL = 'nsahiulin@gmail.com'

def test_send_email_otp():
    if not TO_EMAIL:
        pytest.skip("Не задана переменная окружения TEST_EMAIL")
    
    code = "123456"
    send_email_otp(TO_EMAIL, code, "test")