from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    environment: str = "development"
    groq_api_key: Optional[str] = None
    # Email verification / password reset token lifetimes
    email_verification_expire_minutes: int = 60
    password_reset_expire_minutes: int = 30

    # Where the frontend runs -- used to build links inside emails
    # (e.g. http://localhost:5173/verify-email?token=...)
    frontend_url: str = "http://localhost:5173"

    # Comma-separated browser origins allowed to call this API (CORS).
    # In production set this to your deployed frontend URL(s).
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Gmail SMTP -- gmail_app_password is a 16-character App Password,
    # NOT your normal Gmail password (see backend/README.md for setup).
    gmail_address: str = ""
    gmail_app_password: str = ""

    brevo_api_key: str = ""
    brevo_sender_email: str = ""
    brevo_sender_name: str = "Rydex"

    # HTTPS email via Resend (use this when deployed on a host that blocks
    # SMTP, e.g. Render's free tier). When resend_api_key is set it is used
    # instead of Gmail SMTP. email_from must be on a domain verified in
    # Resend, e.g. "Smart Cab <noreply@yourdomain.com>".
    resend_api_key: str = ""
    email_from: str = ""

    class Config:
        env_file = ".env"


settings = Settings()