from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

Password = Field(min_length=8, max_length=128, description="At least 8 characters")
Phone = Field(min_length=10, max_length=15, pattern=r"^\+?[0-9]{10,15}$")


class _Orm(BaseModel):
    class Config:
        from_attributes = True


# ---------------- Attractions / Tour guide ----------------

class AttractionOut(_Orm):
    attraction_id: int
    name: str
    description: str | None = None
    city: str | None = None
    category: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    created_at: datetime


class AttractionIn(BaseModel):
    name: str
    description: str | None = None
    city: str | None = None
    category: str | None = None
    latitude: Decimal
    longitude: Decimal


# ---------------- Auth: Users ----------------

class UserRegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Phone
    password: str = Password
    gender: str | None = None


class UserOut(_Orm):
    user_id: int
    name: str
    email: EmailStr
    phone: str
    gender: str | None = None
    reward_points: int
    is_verified: bool
    is_active: bool
    is_flagged: bool
    created_at: datetime


# ---------------- Auth: Drivers ----------------

class DriverRegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str = Phone
    password: str = Password
    license_number: str
    vehicle_number: str
    vehicle_type: str | None = None
    fuel_type: str | None = None


class DriverOut(_Orm):
    driver_id: int
    name: str
    email: EmailStr
    phone: str
    license_number: str
    rating: Decimal
    availability_status: bool
    incentive_score: Decimal
    current_lat: Decimal | None = None
    current_lng: Decimal | None = None
    is_verified: bool
    is_active: bool
    created_at: datetime


class DriverAvailabilityIn(BaseModel):
    availability_status: bool
    current_lat: Decimal | None = None
    current_lng: Decimal | None = None


# ---------------- Auth: Admins ----------------

class AdminRegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Password


class AdminOut(_Orm):
    admin_id: int
    username: str
    role: str


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
    new_password: str = Password


# ---------------- Profile management ----------------

class UserUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=10, max_length=15, pattern=r"^\+?[0-9]{10,15}$")
    gender: str | None = Field(default=None, max_length=20)


class DriverUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=10, max_length=15, pattern=r"^\+?[0-9]{10,15}$")


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Password


# ---------------- User vehicles (for DRIVER_RENTAL) ----------------

class UserVehicleIn(BaseModel):
    vehicle_number: str
    vehicle_type: str | None = None
    fuel_type: str | None = None


class UserVehicleOut(_Orm):
    user_vehicle_id: int
    vehicle_number: str
    vehicle_type: str | None = None
    fuel_type: str | None = None
    created_at: datetime


# ---------------- Trips ----------------

class RideRequestIn(BaseModel):
    pickup_location: str
    pickup_lat: Decimal
    pickup_lng: Decimal
    drop_location: str
    drop_lat: Decimal
    drop_lng: Decimal
    preferred_vehicle_type: str | None = None  # Hatchback / Sedan / SUV, optional


class TourRequestIn(BaseModel):
    attraction_id: int
    pickup_location: str
    pickup_lat: Decimal
    pickup_lng: Decimal
    preferred_vehicle_type: str | None = None


class RentalRequestIn(BaseModel):
    user_vehicle_id: int
    pickup_location: str
    pickup_lat: Decimal
    pickup_lng: Decimal
    drop_location: str
    drop_lat: Decimal
    drop_lng: Decimal
    duration_hours: Decimal


class FareEstimateIn(BaseModel):
    service_type: str  # RIDE / TOUR / DRIVER_RENTAL
    pickup_lat: Decimal
    pickup_lng: Decimal
    drop_lat: Decimal | None = None
    drop_lng: Decimal | None = None
    preferred_vehicle_type: str | None = None
    duration_hours: Decimal | None = None


class FareEstimateOut(BaseModel):
    service_type: str
    distance_km: Decimal | None = None
    billed_hours: Decimal | None = None
    base_fare: Decimal
    vehicle_type_multiplier: Decimal
    night_surcharge: bool
    surge_multiplier: Decimal
    tour_guide_fee: Decimal = Decimal("0.00")
    fare: Decimal


class CancelTripIn(BaseModel):
    reason: str | None = None


class TripOut(_Orm):
    trip_id: int
    user_id: int
    passenger_name: str | None = None
    driver_id: int | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    driver_rating: float | None = None
    vehicle_id: int | None = None
    user_vehicle_id: int | None = None
    attraction_id: int | None = None
    attraction_name: str | None = None
    service_type: str
    pickup_location: str
    pickup_lat: Decimal | None = None
    pickup_lng: Decimal | None = None
    drop_location: str
    drop_lat: Decimal | None = None
    drop_lng: Decimal | None = None
    distance_km: Decimal | None = None
    duration_hours: Decimal | None = None
    fare: Decimal | None = None
    surge_multiplier: Decimal | None = None
    vehicle_type_multiplier: Decimal | None = None
    night_surcharge: bool | None = None
    trip_status: str
    cancellation_reason: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    created_at: datetime


# ---------------- Payments ----------------

class PaymentIn(BaseModel):
    payment_mode: str           # WALLET / CARD / UPI / CASH
    points_to_redeem: int = 0   # reward points to apply as discount


class PaymentOut(_Orm):
    payment_id: int
    trip_id: int
    amount: Decimal
    discount_applied: Decimal
    points_redeemed: int
    payment_mode: str
    payment_status: str
    payment_time: datetime | None = None


# ---------------- Feedback ----------------

class FeedbackIn(BaseModel):
    rating: int
    comments: str | None = None


class FeedbackOut(_Orm):
    feedback_id: int
    trip_id: int
    rating: int
    comments: str | None = None
    created_at: datetime


# ---------------- Emergency ----------------

class EmergencyContactIn(BaseModel):
    contact_name: str
    contact_phone: str
    contact_email: EmailStr | None = None
    relation: str | None = None


class EmergencyContactOut(_Orm):
    contact_id: int
    contact_name: str
    contact_phone: str
    contact_email: str | None = None
    relation: str | None = None
    created_at: datetime


class SOSIn(BaseModel):
    trip_id: int
    current_lat: Decimal | None = None
    current_lng: Decimal | None = None


class AlertNotificationOut(_Orm):
    notification_id: int
    contact_id: int
    notified_via: str
    delivery_status: str
    sent_at: datetime


class SafetyAlertOut(_Orm):
    alert_id: int
    trip_id: int
    user_id: int
    alert_type: str
    alert_lat: Decimal | None = None
    alert_lng: Decimal | None = None
    alert_status: str
    alert_time: datetime
    notifications: list[AlertNotificationOut] = []


# ---------------- Rewards ----------------

class RewardTransactionOut(_Orm):
    reward_txn_id: int
    trip_id: int | None = None
    points_change: int
    reason: str | None = None
    created_at: datetime


class RewardSummaryOut(BaseModel):
    reward_points: int
    point_value_rupees: Decimal
    max_discount_fraction: Decimal
    history: list[RewardTransactionOut]


# ---------------- Admin ----------------

class AdminStatsOut(BaseModel):
    total_users: int
    total_drivers: int
    active_drivers: int
    total_trips: int
    completed_trips: int
    cancelled_trips: int
    ongoing_trips: int
    total_revenue: Decimal
    total_alerts: int
    open_alerts: int
    avg_driver_rating: float | None = None


class AdminToggleIn(BaseModel):
    value: bool