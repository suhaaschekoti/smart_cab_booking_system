from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, role: str) -> str:
    """
    subject: the user/driver/admin's unique id (as a string)
    role:    "user" | "driver" | "admin" -- embedded in the token so
             every protected route knows who's calling without a DB hit.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jose.JWTError if the token is invalid or expired."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def create_action_token(subject: str, role: str, purpose: str, expire_minutes: int) -> str:
    """
    A short-lived, single-purpose token -- used for email verification
    and password reset links, kept separate from login access tokens so
    one can never be used in place of the other (checked via `purpose`).
    Stateless (no DB row to track/revoke) -- fine for this project's
    scope; a production system would likely also store a hash of these
    to allow early invalidation (e.g. after the link is used once).
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {"sub": subject, "role": role, "purpose": purpose, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_action_token(token: str, expected_purpose: str) -> dict:
    """
    Raises jose.JWTError if invalid/expired, or ValueError if the
    token's purpose doesn't match what the calling endpoint expects
    (e.g. a verification token used on the reset-password endpoint).
    """
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("purpose") != expected_purpose:
        raise ValueError("Token purpose mismatch")
    return payload