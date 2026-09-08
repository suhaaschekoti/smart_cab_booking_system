"""
Sends real emails via Gmail SMTP. Requires a Gmail App Password (not
your normal Gmail password) -- see backend/README.md for setup steps.

Kept deliberately simple: synchronous smtplib call, no queue/retry.
Fine for this project's scale (occasional verification/reset emails,
not bulk sending).
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException, status

from app.config import settings


def send_email(to_email: str, subject: str, html_body: str) -> None:
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Email sending is not configured -- set GMAIL_ADDRESS and "
            "GMAIL_APP_PASSWORD in backend/.env (see README for setup steps).",
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.gmail_address
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(settings.gmail_address, settings.gmail_app_password)
            server.sendmail(settings.gmail_address, [to_email], msg.as_string())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Gmail rejected the login -- double check GMAIL_ADDRESS and "
            "that GMAIL_APP_PASSWORD is a valid 16-character App Password.",
        )
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Could not send email: {e}")


def send_verification_email(to_email: str, name: str, role: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}&role={role}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2 style="color: #f4b942;">Smart Cab Booking</h2>
      <p>Hi {name},</p>
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
        This link expires in {settings.email_verification_expire_minutes} minutes.
        If you didn't create this account, you can ignore this email.
      </p>
    </div>
    """
    send_email(to_email, "Verify your Smart Cab Booking account", html)


def send_password_reset_email(to_email: str, name: str, role: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}&role={role}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2 style="color: #f4b942;">Smart Cab Booking</h2>
      <p>Hi {name},</p>
      <p>We received a request to reset your password. Click below to choose a new one:</p>
      <p>
        <a href="{link}"
           style="background:#f4b942; color:#0f1420; padding:10px 20px;
                  border-radius:6px; text-decoration:none; font-weight:600;
                  display:inline-block;">
          Reset my password
        </a>
      </p>
      <p style="color:#8891a7; font-size:13px;">
        This link expires in {settings.password_reset_expire_minutes} minutes.
        If you didn't request this, you can safely ignore this email --
        your password will not be changed.
      </p>
    </div>
    """
    send_email(to_email, "Reset your Smart Cab Booking password", html)