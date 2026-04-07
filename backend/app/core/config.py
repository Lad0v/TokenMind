from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "FastAPI Boilerplate"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "Монолитный FastAPI проект"

    DATABASE_URL: str = "sqlite:///./app.db"

    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    EMAIL_VERIFY_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    OTP_TOKEN_EXPIRE_MINUTES: int = 10
    REQUIRE_EMAIL_VERIFICATION: bool = False

    # CORS Settings
    ENABLE_CORS: bool = True
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    DEBUG: bool = False

    # ======================================================================
    # IP Intelligence Module Settings (Patent APIs)
    # ======================================================================

    # Enable/Disable IP Intelligence module
    ENABLE_IP_INTEL: bool = True

    # USPTO API Key (free, register at https://developer.uspto.gov/)
    USPTO_API_KEY: Optional[str] = None

    # EPO OPS OAuth2 credentials (free, register at https://worldwide.espacenet.com/ops)
    EPO_OPS_CONSUMER_KEY: Optional[str] = None
    EPO_OPS_CONSUMER_SECRET: Optional[str] = None

    # WIPO PATENTSCOPE API Key (optional, some endpoints require auth)
    WIPO_API_KEY: Optional[str] = None

    # Redis URL for caching (optional, falls back to database cache)
    # Set to empty string or omit to disable Redis
    REDIS_URL: Optional[str] = None
    ENABLE_REDIS: bool = True  # Set to False to disable Redis completely

    # Cache TTL for patent data (hours)
    PATENT_CACHE_TTL_HOURS: int = 48

    # Rate limiting for external API calls (calls per second)
    EXTERNAL_API_RATE_LIMIT: float = 5.0

    # Timeout for external API calls (seconds)
    EXTERNAL_API_TIMEOUT: float = 30.0

    # Enable audit logging for external API calls
    ENABLE_EXTERNAL_API_AUDIT: bool = True

    # Email OTP — Gmail SMTP (free). Enable 2FA in Google Account and create an App Password.
    # ======================================================================

    # SMS OTP — set to True to enable SMS delivery (requires SMS provider integration)
    ENABLE_SMS_OTP: bool = False

    # SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""  # ← в .env тоже переименуй в SMTP_PASSWORD
    SMTP_FROM_EMAIL: str = "noreply@localhost"

    # Redis
    REDIS_PASSWORD: str = ""

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "ip-documents"
    MINIO_USE_SSL: bool = False

    # ======================================================================
    # Solana / Blockchain Integration
    # ======================================================================
    ENABLE_BLOCKCHAIN: bool = True
    SOLANA_NETWORK: str = "localnet"
    SOLANA_RPC_URL: str = "http://host.docker.internal:8899"
    SOLANA_COMMITMENT: str = "confirmed"
    SOLANA_PROGRAM_ID: str = "4XeEJCxc1TLRaFzyfjYjELPdExY1imRAqiZqjuRqz6Kt"
    SOLANA_PLATFORM_TREASURY: str = "11111111111111111111111111111111"
    SOLANA_EXPLORER_BASE_URL: str = "https://explorer.solana.com"

    # вместо старого class Config:
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        case_sensitive=True,
        extra="ignore"  # игнорировать лишние переменные из .env
    )


settings = Settings()
