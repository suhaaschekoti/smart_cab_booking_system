from sqlalchemy import (
    Column, Integer, String, Boolean, DECIMAL, TIMESTAMP,
    ForeignKey, CheckConstraint, func
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(15), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    gender = Column(String(20))
    reward_points = Column(Integer, default=0)
    safety_mode_enabled = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    trips = relationship("Trip", back_populates="user")
    emergency_contacts = relationship("EmergencyContact", back_populates="user")
    vehicles = relationship("UserVehicle", back_populates="user")


class Driver(Base):
    __tablename__ = "drivers"

    driver_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(15), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    rating = Column(DECIMAL(2, 1), default=5.0)
    availability_status = Column(Boolean, default=False)
    incentive_score = Column(DECIMAL(6, 2), default=0)
    current_lat = Column(DECIMAL(9, 6))
    current_lng = Column(DECIMAL(9, 6))
    created_at = Column(TIMESTAMP, server_default=func.now())

    vehicles = relationship("Vehicle", back_populates="driver")
    trips = relationship("Trip", back_populates="driver")


class Vehicle(Base):
    """A driver's own vehicle -- used for RIDE and TOUR trips."""
    __tablename__ = "vehicles"

    vehicle_id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.driver_id", ondelete="CASCADE"), nullable=False)
    vehicle_number = Column(String(20), unique=True, nullable=False)
    vehicle_type = Column(String(30))
    fuel_type = Column(String(20))

    driver = relationship("Driver", back_populates="vehicles")


class UserVehicle(Base):
    """A passenger's own vehicle -- used only for DRIVER_RENTAL trips
    (a driver comes to drive the passenger's car, e.g. drunk pickup)."""
    __tablename__ = "user_vehicles"

    user_vehicle_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    vehicle_number = Column(String(20), nullable=False)
    vehicle_type = Column(String(30))
    fuel_type = Column(String(20))
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="vehicles")


class Admin(Base):
    __tablename__ = "admins"

    admin_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="systemManager")


class Attraction(Base):
    """Tour guide feature -- suggested nearby places a user can book a ride/tour to."""
    __tablename__ = "attractions"

    attraction_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(String(500))
    city = Column(String(100))
    category = Column(String(50))
    latitude = Column(DECIMAL(9, 6))
    longitude = Column(DECIMAL(9, 6))
    created_at = Column(TIMESTAMP, server_default=func.now())

    trips = relationship("Trip", back_populates="attraction")


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.driver_id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id"))               # RIDE / TOUR
    user_vehicle_id = Column(Integer, ForeignKey("user_vehicles.user_vehicle_id"))  # DRIVER_RENTAL
    attraction_id = Column(Integer, ForeignKey("attractions.attraction_id"))       # TOUR destination
    service_type = Column(String(20), nullable=False, default="RIDE")  # RIDE / DRIVER_RENTAL / TOUR
    pickup_location = Column(String(255), nullable=False)
    pickup_lat = Column(DECIMAL(9, 6))
    pickup_lng = Column(DECIMAL(9, 6))
    drop_location = Column(String(255), nullable=False)
    drop_lat = Column(DECIMAL(9, 6))
    drop_lng = Column(DECIMAL(9, 6))
    distance_km = Column(DECIMAL(6, 2))
    duration_hours = Column(DECIMAL(5, 2))  # used for DRIVER_RENTAL (time-based billing)
    fare = Column(DECIMAL(8, 2))
    trip_status = Column(String(20), default="REQUESTED")
    start_time = Column(TIMESTAMP)
    end_time = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "(service_type IN ('RIDE', 'TOUR') AND vehicle_id IS NOT NULL AND user_vehicle_id IS NULL) OR "
            "(service_type = 'DRIVER_RENTAL' AND user_vehicle_id IS NOT NULL AND vehicle_id IS NULL)",
            name="trip_service_type_vehicle_check",
        ),
    )

    user = relationship("User", back_populates="trips")
    driver = relationship("Driver", back_populates="trips")
    attraction = relationship("Attraction", back_populates="trips")
    payment = relationship("Payment", back_populates="trip", uselist=False)
    feedback = relationship("Feedback", back_populates="trip", uselist=False)


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.trip_id"), unique=True, nullable=False)
    amount = Column(DECIMAL(8, 2), nullable=False)
    payment_mode = Column(String(20))
    payment_status = Column(String(20), default="PENDING")
    payment_time = Column(TIMESTAMP)

    trip = relationship("Trip", back_populates="payment")


class Feedback(Base):
    __tablename__ = "feedback"

    feedback_id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.trip_id"), unique=True, nullable=False)
    rating = Column(Integer)
    comments = Column(String(500))
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5"),)

    trip = relationship("Trip", back_populates="feedback")


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    contact_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    contact_name = Column(String(100), nullable=False)
    contact_phone = Column(String(15), nullable=False)
    relation = Column(String(50))
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="emergency_contacts")


class SafetyAlert(Base):
    __tablename__ = "safety_alerts"

    alert_id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.trip_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    alert_type = Column(String(50), default="EmergencyContactShare")
    alert_lat = Column(DECIMAL(9, 6))
    alert_lng = Column(DECIMAL(9, 6))
    alert_status = Column(String(20), default="SENT")
    alert_time = Column(TIMESTAMP, server_default=func.now())


class AlertNotification(Base):
    __tablename__ = "alert_notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("safety_alerts.alert_id", ondelete="CASCADE"), nullable=False)
    contact_id = Column(Integer, ForeignKey("emergency_contacts.contact_id"), nullable=False)
    notified_via = Column(String(20), default="SMS")
    delivery_status = Column(String(20), default="SENT")
    sent_at = Column(TIMESTAMP, server_default=func.now())


class RewardTransaction(Base):
    __tablename__ = "reward_transactions"

    reward_txn_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    trip_id = Column(Integer, ForeignKey("trips.trip_id"))
    points_change = Column(Integer, nullable=False)
    reason = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())
