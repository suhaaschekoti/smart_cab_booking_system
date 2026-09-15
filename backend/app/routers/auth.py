from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
    create_action_token, decode_action_token, password_fingerprint,
)
from app.database import get_db
from app.email_utils import send_verification_email, send_password_reset_email
from app.ratelimit import check_rate

# Used to keep login timing constant when the account doesn't exist,
# so response time can't be used to enumerate registered emails.
_DUMMY_HASH = hash_password("dummy-password-for-timing")

router = APIRouter()

bearer_scheme = HTTPBearer()


# ------------------------------------------------------------
# USER (Passenger)
# ------------------------------------------------------------

@router.post("/user/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.UserRegisterIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "register", limit=5, window_s=300)
    user = models.User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        gender=payload.gender,
        is_verified=False,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or phone already registered")
    db.refresh(user)

    token = create_action_token(str(user.user_id), "user", "email_verify", 60)
    send_verification_email(user.email, user.name, "user", token)

    return user


@router.post("/user/login", response_model=schemas.TokenOut)
def login_user(payload: schemas.LoginIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "login")
    user = db.query(models.User).filter(models.User.email == payload.email_or_username).first()
    ok = verify_password(payload.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Please verify your email before logging in. Check your inbox for the verification link.",
        )
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been suspended. Contact support.")
    token = create_access_token(subject=str(user.user_id), role="user")
    return schemas.TokenOut(access_token=token)


@router.get("/user/verify-email", response_model=schemas.MessageOut)
def verify_user_email(token: str, db: Session = Depends(get_db)):
    try:
        payload = decode_action_token(token, expected_purpose="email_verify")
        if payload.get("role") != "user":
            raise ValueError("Wrong role")
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification link is invalid or has expired.")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")

    user.is_verified = True
    db.commit()
    return schemas.MessageOut(message="Email verified. You can now log in.")


@router.post("/user/forgot-password", response_model=schemas.MessageOut)
def forgot_user_password(payload: schemas.ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "forgot", limit=3, window_s=300)
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        token = create_action_token(str(user.user_id), "user", "password_reset", 30, {"pf": password_fingerprint(user.password_hash)})
        send_password_reset_email(user.email, user.name, "user", token)
    return schemas.MessageOut(message="If that email is registered, a reset link has been sent.")


@router.post("/user/reset-password", response_model=schemas.MessageOut)
def reset_user_password(payload: schemas.ResetPasswordIn, db: Session = Depends(get_db)):
    try:
        token_payload = decode_action_token(payload.token, expected_purpose="password_reset")
        if token_payload.get("role") != "user":
            raise ValueError("Wrong role")
        user_id = int(token_payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired.")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")
    if token_payload.get("pf") != password_fingerprint(user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link has already been used.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return schemas.MessageOut(message="Password updated. You can now log in with your new password.")


def _change_password(account, payload: schemas.ChangePasswordIn, db: Session):
    if not verify_password(payload.current_password, account.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different from the current one")
    account.password_hash = hash_password(payload.new_password)
    db.commit()
    return schemas.MessageOut(message="Password updated.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("role") != "user":
            raise credentials_error
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise credentials_error

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise credentials_error
    return user


# ------------------------------------------------------------
# DRIVER
# ------------------------------------------------------------

@router.post("/driver/register", response_model=schemas.DriverOut, status_code=status.HTTP_201_CREATED)
def register_driver(payload: schemas.DriverRegisterIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "register", limit=5, window_s=300)
    driver = models.Driver(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        license_number=payload.license_number,
        is_verified=False,
    )
    db.add(driver)
    try:
        db.flush()  # assigns driver.driver_id without ending the transaction

        vehicle = models.Vehicle(
            driver_id=driver.driver_id,
            vehicle_number=payload.vehicle_number,
            vehicle_type=payload.vehicle_type,
            fuel_type=payload.fuel_type,
        )
        db.add(vehicle)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Email, phone, license number, or vehicle number already registered",
        )
    db.refresh(driver)

    token = create_action_token(str(driver.driver_id), "driver", "email_verify", 60)
    send_verification_email(driver.email, driver.name, "driver", token)

    return driver


@router.post("/driver/login", response_model=schemas.TokenOut)
def login_driver(payload: schemas.LoginIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "login")
    driver = db.query(models.Driver).filter(models.Driver.email == payload.email_or_username).first()
    ok = verify_password(payload.password, driver.password_hash if driver else _DUMMY_HASH)
    if not driver or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not driver.is_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Please verify your email before logging in. Check your inbox for the verification link.",
        )
    if not driver.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been suspended. Contact support.")
    token = create_access_token(subject=str(driver.driver_id), role="driver")
    return schemas.TokenOut(access_token=token)


@router.get("/driver/verify-email", response_model=schemas.MessageOut)
def verify_driver_email(token: str, db: Session = Depends(get_db)):
    try:
        payload = decode_action_token(token, expected_purpose="email_verify")
        if payload.get("role") != "driver":
            raise ValueError("Wrong role")
        driver_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification link is invalid or has expired.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")

    driver.is_verified = True
    db.commit()
    return schemas.MessageOut(message="Email verified. You can now log in.")


@router.post("/driver/forgot-password", response_model=schemas.MessageOut)
def forgot_driver_password(payload: schemas.ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "forgot", limit=3, window_s=300)
    driver = db.query(models.Driver).filter(models.Driver.email == payload.email).first()
    if driver:
        token = create_action_token(str(driver.driver_id), "driver", "password_reset", 30, {"pf": password_fingerprint(driver.password_hash)})
        send_password_reset_email(driver.email, driver.name, "driver", token)
    return schemas.MessageOut(message="If that email is registered, a reset link has been sent.")


@router.post("/driver/reset-password", response_model=schemas.MessageOut)
def reset_driver_password(payload: schemas.ResetPasswordIn, db: Session = Depends(get_db)):
    try:
        token_payload = decode_action_token(payload.token, expected_purpose="password_reset")
        if token_payload.get("role") != "driver":
            raise ValueError("Wrong role")
        driver_id = int(token_payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")
    if token_payload.get("pf") != password_fingerprint(driver.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link has already been used.")

    driver.password_hash = hash_password(payload.new_password)
    db.commit()
    return schemas.MessageOut(message="Password updated. You can now log in with your new password.")


def get_current_driver(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Driver:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("role") != "driver":
            raise credentials_error
        driver_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise credentials_error

    driver = db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()
    if not driver:
        raise credentials_error
    return driver


# ------------------------------------------------------------
# ADMIN (no email column -- no verification/reset for this role)
# ------------------------------------------------------------

@router.post("/admin/register", response_model=schemas.AdminOut, status_code=status.HTTP_201_CREATED)
def register_admin(
    payload: schemas.AdminRegisterIn,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Only an existing admin can create another admin. The first admin is
    created by scripts/seed_db.py (or directly in the database)."""
    get_current_admin(credentials, db)  # raises 401 unless a valid admin token is presented
    admin = models.Admin(
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(admin)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    db.refresh(admin)
    return admin


@router.post("/admin/login", response_model=schemas.TokenOut)
def login_admin(payload: schemas.LoginIn, request: Request, db: Session = Depends(get_db)):
    check_rate(request, "login", limit=5)
    admin = db.query(models.Admin).filter(models.Admin.username == payload.email_or_username).first()
    ok = verify_password(payload.password, admin.password_hash if admin else _DUMMY_HASH)
    if not admin or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password")
    token = create_access_token(subject=str(admin.admin_id), role="admin")
    return schemas.TokenOut(access_token=token)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Admin:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(credentials.credentials)
        if payload.get("role") != "admin":
            raise credentials_error
        admin_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise credentials_error

    admin = db.query(models.Admin).filter(models.Admin.admin_id == admin_id).first()
    if not admin:
        raise credentials_error
    return admin


# ------------------------------------------------------------
# Profile management (self-service)
# ------------------------------------------------------------

@router.get("/user/me", response_model=schemas.UserOut)
def user_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/user/me", response_model=schemas.UserOut)
def update_user_me(payload: schemas.UserUpdateIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(current_user, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That phone number is already in use")
    db.refresh(current_user)
    return current_user


@router.post("/user/me/password", response_model=schemas.MessageOut)
def change_user_password(payload: schemas.ChangePasswordIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return _change_password(current_user, payload, db)


@router.patch("/driver/me", response_model=schemas.DriverOut)
def update_driver_me(payload: schemas.DriverUpdateIn, db: Session = Depends(get_db), current_driver: models.Driver = Depends(get_current_driver)):
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(current_driver, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That phone number is already in use")
    db.refresh(current_driver)
    return current_driver


@router.post("/driver/me/password", response_model=schemas.MessageOut)
def change_driver_password(payload: schemas.ChangePasswordIn, db: Session = Depends(get_db), current_driver: models.Driver = Depends(get_current_driver)):
    return _change_password(current_driver, payload, db)