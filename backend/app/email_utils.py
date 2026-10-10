"""
Sends transactional emails through the Brevo HTTPS API.

Requires the following environment variables in backend/.env:
    BREVO_API_KEY
    BREVO_SENDER_EMAIL
    BREVO_SENDER_NAME

The sender email must be verified in Brevo.
"""

import html

import httpx
from fastapi import HTTPException, status

from app.config import settings


BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"


def send_email(to_email: str, subject: str, html_body: str) -> None:
    """Send an HTML email using Brevo's transactional email API."""

    if not settings.brevo_api_key or not settings.brevo_sender_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Email sending is not configured. Set BREVO_API_KEY and "
                "BREVO_SENDER_EMAIL in backend/.env."
            ),
        )

    payload = {
        "sender": {
            "name": settings.brevo_sender_name,
            "email": settings.brevo_sender_email,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_body,
    }

    headers = {
        "api-key": settings.brevo_api_key,
        "accept": "application/json",
        "content-type": "application/json",
    }

    try:
        response = httpx.post(
            BREVO_EMAIL_URL,
            headers=headers,
            json=payload,
            timeout=15.0,
        )
        response.raise_for_status()

    except httpx.HTTPStatusError as exc:
        print(
            "Brevo email request failed with HTTP status:",
            exc.response.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The email provider rejected the request. Check your "
                "Brevo API key, sender verification, and account status."
            ),
        ) from exc

    except httpx.RequestError as exc:
        print("Could not connect to Brevo:", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to contact the email provider.",
        ) from exc


def send_verification_email(
    to_email: str,
    name: str,
    role: str,
    token: str,
) -> None:
    """Send an account verification email."""

    safe_name = html.escape(name)
    safe_role = html.escape(role, quote=True)
    safe_token = html.escape(token, quote=True)

    link = (
        f"{settings.frontend_url.rstrip('/')}"
        f"/verify-email?token={safe_token}&role={safe_role}"
    )

    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2 style="color: #f4b942;">Smart Cab Booking</h2>
      <p>Hi {safe_name},</p>
      <p>Please confirm your email address to activate your account:</p>
      <p>
        <a href="{link}"
           style="background:#f4b942; color:#0f1420; padding:10px 20px;
                  border-radius:6px; text-decoration:none; font-weight:600;
                  display:inline-block;">
          Verify my email
        </a>
      </p>
      <p style="color:#8891a7; font-size:13px;">
        This link expires in
        {settings.email_verification_expire_minutes} minutes.
        If you didn't create this account, you can ignore this email.
      </p>
    </div>
    """

    send_email(
        to_email,
        "Verify your Smart Cab Booking account",
        html_body,
    )


def send_password_reset_email(
    to_email: str,
    name: str,
    role: str,
    token: str,
) -> None:
    """Send a password reset email."""

    safe_name = html.escape(name)
    safe_role = html.escape(role, quote=True)
    safe_token = html.escape(token, quote=True)

    link = (
        f"{settings.frontend_url.rstrip('/')}"
        f"/reset-password?token={safe_token}&role={safe_role}"
    )

    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2 style="color: #f4b942;">Smart Cab Booking</h2>
      <p>Hi {safe_name},</p>
      <p>
        We received a request to reset your password.
        Click below to choose a new one:
      </p>
      <p>
        <a href="{link}"
           style="background:#f4b942; color:#0f1420; padding:10px 20px;
                  border-radius:6px; text-decoration:none; font-weight:600;
                  display:inline-block;">
          Reset my password
        </a>
      </p>
      <p style="color:#8891a7; font-size:13px;">
        This link expires in {settings.password_reset_expire_minutes}
        minutes. If you didn't request this, you can safely ignore
        this email -- your password will not be changed.
      </p>
    </div>
    """

    send_email(
        to_email,
        "Reset your Smart Cab Booking password",
        html_body,
    )