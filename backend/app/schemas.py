from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr


class AttractionOut(BaseModel):
    attraction_id: int
    name: str
    description: str | None = None
    city: str | None = None
    category: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    created_at: datetime

    class Config:
        from_attributes = True  # lets this read directly from a SQLAlchemy model instance


# ---------------- Auth: Users (Passengers) ----------------

class UserRegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    gender: str | None = None


class UserOut(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    phone: str
    gender: str | None = None
    reward_points: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Auth: Drivers ----------------

class DriverRegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    license_number: str


class DriverOut(BaseModel):
    driver_id: int
    name: str
    email: EmailStr
    phone: str
    license_number: str
    rating: Decimal
    availability_status: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Auth: Admins ----------------

class AdminRegisterIn(BaseModel):
    username: str
    password: str


class AdminOut(BaseModel):
    admin_id: int
    username: str
    role: str

    class Config:
        from_attributes = True


# ---------------- Shared ----------------

class LoginIn(BaseModel):
    email_or_username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Add more Out/In schemas here as new routes are built (trips, payments, etc.)
