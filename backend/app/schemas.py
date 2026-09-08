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
    is_verified: bool
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
    vehicle_number: str
    vehicle_type: str | None = None
    fuel_type: str | None = None


class DriverOut(BaseModel):
    driver_id: int
    name: str
    email: EmailStr
    phone: str
    license_number: str
    rating: Decimal
    availability_status: bool
    current_lat: Decimal | None = None
    current_lng: Decimal | None = None
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DriverAvailabilityIn(BaseModel):
    availability_status: bool
    current_lat: Decimal | None = None
    current_lng: Decimal | None = None


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


class MessageOut(BaseModel):
    message: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


# ---------------- Trips (RIDE only, for now) ----------------

class TripRequestIn(BaseModel):
    pickup_location: str
    pickup_lat: Decimal
    pickup_lng: Decimal
    drop_location: str
    drop_lat: Decimal
    drop_lng: Decimal


class TripOut(BaseModel):
    trip_id: int
    user_id: int
    driver_id: int | None = None
    vehicle_id: int | None = None
    service_type: str
    pickup_location: str
    pickup_lat: Decimal | None = None
    pickup_lng: Decimal | None = None
    drop_location: str
    drop_lat: Decimal | None = None
    drop_lng: Decimal | None = None
    distance_km: Decimal | None = None
    fare: Decimal | None = None
    trip_status: str
    start_time: datetime | None = None
    end_time: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# Add more Out/In schemas here as new routes are built (payments, etc.)