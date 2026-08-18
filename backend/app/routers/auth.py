from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
)
from app.database import get_db

router = APIRouter()

# Each role gets its own token URL so Swagger's "Authorize" button
# and any OAuth2 tooling knows which login endpoint issued the token.
user_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/user/login")
driver_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/driver/login")
admin_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/admin/login")


# ------------------------------------------------------------
# USER (Passenger)
# ------------------------------------------------------------

@router.post("/user/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.UserRegisterIn, db: Session = Depends(get_db)):
    user = models.User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        gender=payload.gender,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or phone already registered")
    db.refresh(user)
    return user


@router.post("/user/login", response_model=schemas.TokenOut)
def login_user(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email_or_username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    token = create_access_token(subject=str(user.user_id), role="user")
    return schemas.TokenOut(access_token=token)


def get_current_user(token: str = Depends(user_oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(token)
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
def register_driver(payload: schemas.DriverRegisterIn, db: Session = Depends(get_db)):
    driver = models.Driver(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        license_number=payload.license_number,
    )
    db.add(driver)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email, phone, or license number already registered")
    db.refresh(driver)
    return driver


@router.post("/driver/login", response_model=schemas.TokenOut)
def login_driver(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    driver = db.query(models.Driver).filter(models.Driver.email == payload.email_or_username).first()
    if not driver or not verify_password(payload.password, driver.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    token = create_access_token(subject=str(driver.driver_id), role="driver")
    return schemas.TokenOut(access_token=token)


def get_current_driver(token: str = Depends(driver_oauth2_scheme), db: Session = Depends(get_db)) -> models.Driver:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(token)
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
# ADMIN
# ------------------------------------------------------------

@router.post("/admin/register", response_model=schemas.AdminOut, status_code=status.HTTP_201_CREATED)
def register_admin(payload: schemas.AdminRegisterIn, db: Session = Depends(get_db)):
    # In practice you'll likely lock this route down (e.g. only callable
    # once, or protected behind an existing admin) rather than leaving it
    # open -- flagged here as a TODO for whoever builds out the Admin module.
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
def login_admin(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == payload.email_or_username).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password")
    token = create_access_token(subject=str(admin.admin_id), role="admin")
    return schemas.TokenOut(access_token=token)


def get_current_admin(token: str = Depends(admin_oauth2_scheme), db: Session = Depends(get_db)) -> models.Admin:
    credentials_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(token)
        if payload.get("role") != "admin":
            raise credentials_error
        admin_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise credentials_error

    admin = db.query(models.Admin).filter(models.Admin.admin_id == admin_id).first()
    if not admin:
        raise credentials_error
    return admin
