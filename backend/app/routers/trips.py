from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.pricing import haversine_km, calculate_fare
from app.routers import auth

router = APIRouter()


def find_nearest_available_driver(db: Session, pickup_lat: float, pickup_lng: float):
    """
    Returns (driver, vehicle) for the nearest available driver who ALSO
    has a registered vehicle -- a RIDE trip can't be assigned to a driver
    with no vehicle (see the Trip CHECK constraint), so drivers without
    one are excluded from matching entirely rather than being matched
    and then failing to assign.
    """
    candidates = (
        db.query(models.Driver, models.Vehicle)
        .join(models.Vehicle, models.Vehicle.driver_id == models.Driver.driver_id)
        .filter(models.Driver.availability_status.is_(True))
        .filter(models.Driver.current_lat.isnot(None))
        .filter(models.Driver.current_lng.isnot(None))
        .all()
    )
    if not candidates:
        return None, None

    nearest_driver, nearest_vehicle = min(
        candidates,
        key=lambda pair: haversine_km(
            pickup_lat, pickup_lng, float(pair[0].current_lat), float(pair[0].current_lng)
        ),
    )
    return nearest_driver, nearest_vehicle


# ------------------------------------------------------------
# PASSENGER: request a ride
# ------------------------------------------------------------

@router.post("", response_model=schemas.TripOut, status_code=status.HTTP_201_CREATED)
def request_trip(
    payload: schemas.TripRequestIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    distance_km = haversine_km(
        float(payload.pickup_lat), float(payload.pickup_lng),
        float(payload.drop_lat), float(payload.drop_lng),
    )
    fare = calculate_fare(distance_km)

    matched_driver, matched_vehicle = find_nearest_available_driver(
        db, float(payload.pickup_lat), float(payload.pickup_lng)
    )

    trip = models.Trip(
        user_id=current_user.user_id,
        driver_id=matched_driver.driver_id if matched_driver else None,
        vehicle_id=matched_vehicle.vehicle_id if matched_vehicle else None,
        service_type="RIDE",
        pickup_location=payload.pickup_location,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        drop_location=payload.drop_location,
        drop_lat=payload.drop_lat,
        drop_lng=payload.drop_lng,
        distance_km=round(distance_km, 2),
        fare=fare,
        trip_status="REQUESTED",
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


# ------------------------------------------------------------
# PASSENGER: trip history
# ------------------------------------------------------------

@router.get("/my", response_model=list[schemas.TripOut])
def my_trips(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Trip)
        .filter(models.Trip.user_id == current_user.user_id)
        .order_by(models.Trip.created_at.desc())
        .all()
    )


# ------------------------------------------------------------
# DRIVER: assigned trips
# ------------------------------------------------------------

@router.get("/driver/assigned", response_model=list[schemas.TripOut])
def driver_assigned_trips(
    db: Session = Depends(get_db),
    current_driver: models.Driver = Depends(auth.get_current_driver),
):
    return (
        db.query(models.Trip)
        .filter(models.Trip.driver_id == current_driver.driver_id)
        .order_by(models.Trip.created_at.desc())
        .all()
    )


# ------------------------------------------------------------
# Lifecycle transitions
# ------------------------------------------------------------

def _get_trip_or_404(db: Session, trip_id: int) -> models.Trip:
    trip = db.query(models.Trip).filter(models.Trip.trip_id == trip_id).first()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return trip


@router.patch("/{trip_id}/accept", response_model=schemas.TripOut)
def accept_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_driver: models.Driver = Depends(auth.get_current_driver),
):
    trip = _get_trip_or_404(db, trip_id)
    if trip.driver_id != current_driver.driver_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This trip is not assigned to you")
    if trip.trip_status != "REQUESTED":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip is already {trip.trip_status}")

    trip.trip_status = "ACCEPTED"
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/start", response_model=schemas.TripOut)
def start_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_driver: models.Driver = Depends(auth.get_current_driver),
):
    trip = _get_trip_or_404(db, trip_id)
    if trip.driver_id != current_driver.driver_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This trip is not assigned to you")
    if trip.trip_status != "ACCEPTED":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip must be ACCEPTED first (currently {trip.trip_status})")

    trip.trip_status = "ONGOING"
    trip.start_time = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/complete", response_model=schemas.TripOut)
def complete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_driver: models.Driver = Depends(auth.get_current_driver),
):
    trip = _get_trip_or_404(db, trip_id)
    if trip.driver_id != current_driver.driver_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This trip is not assigned to you")
    if trip.trip_status != "ONGOING":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip must be ONGOING first (currently {trip.trip_status})")

    trip.trip_status = "COMPLETED"
    trip.end_time = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/cancel", response_model=schemas.TripOut)
def cancel_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    trip = _get_trip_or_404(db, trip_id)
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    if trip.trip_status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip is already {trip.trip_status}")

    trip.trip_status = "CANCELLED"
    db.commit()
    db.refresh(trip)
    return trip