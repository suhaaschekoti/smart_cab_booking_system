from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    environment: str = "development"

    # Email verification / password reset token lifetimes
    email_verification_expire_minutes: int = 60
    password_reset_expire_minutes: int = 30

    # Where the frontend runs -- used to build links inside emails
    # (e.g. http://localhost:5173/verify-email?token=...)
    frontend_url: str = "http://localhost:5173"

    # Gmail SMTP -- gmail_app_password is a 16-character App Password,
    # NOT your normal Gmail password (see backend/README.md for setup).
    gmail_address: str = ""
    gmail_app_password: str = ""

    class Config:
        env_file = ".env"


settings = Settings()