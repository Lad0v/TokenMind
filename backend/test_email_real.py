"""Quick test: real SMTP email send using app settings."""
import sys
sys.path.insert(0, ".")

from app.services.otp_sender import send_email_otp

# Запрашиваем email для теста
to_email = input("Введите email для теста: ").strip()
if not to_email:
    print("Email не указан. Отмена.")
    sys.exit(1)

code = "123456"
print(f"\nОтправляю OTP код '{code}' на {to_email}...")

try:
    send_email_otp(to_email, code, "test")
    print("✅ Email отправлен успешно! Проверьте почту.")
except RuntimeError as e:
    print(f"❌ Ошибка отправки: {e}")
    print("\nВозможные причины:")
    print("  1. Неверный SMTP_USER или SMTP_PASSWORD")
    print("  2. Для Gmail нужен App Password (не обычный пароль)")
    print("  3. Не включена 2FA в Google аккаунте")
    print("  4. SMTP_HOST/PORT неверные")
except Exception as e:
    print(f"❌ Неожиданная ошибка: {e}")
