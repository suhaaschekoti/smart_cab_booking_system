from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.pricing import (
    haversine_km, is_night, compute_surge_multiplier,
    calculate_ride_fare, calculate_rental_fare, REWARD_POINTS_PER_TRIP,
)
from app.routers import auth

router = APIRouter()

TRIP_LOAD = [joinedload(models.Trip.driver), joinedload(models.Trip.attraction), joinedload(models.Trip.user)]


# ------------------------------------------------------------
# Matching
# ------------------------------------------------------------

def _available_driver_query(db: Session):
    return (
        db.query(models.Driver)
        .filter(models.Driver.availability_status.is_(True))
        .filter(models.Driver.is_active.is_(True))
        .filter(models.Driver.is_verified.is_(True))
        .filter(models.Driver.current_lat.isnot(None))
        .filter(models.Driver.current_lng.isnot(None))
    )


def find_driver_with_vehicle(db: Session, lat: float, lng: float, preferred_type: str | None):
    """
    RIDE / TOUR: nearest available driver who also has a vehicle.
    If a preferred vehicle type is given, prefer drivers with that type;
    fall back to any type if none match.
    """
    candidates = (
        db.query(models.Driver, models.Vehicle)
        .join(models.Vehicle, models.Vehicle.driver_id == models.Driver.driver_id)
        .filter(models.Driver.availability_status.is_(True))
        .filter(models.Driver.is_active.is_(True))
        .filter(models.Driver.is_verified.is_(True))
        .filter(models.Driver.current_lat.isnot(None))
        .filter(models.Driver.current_lng.isnot(None))
        .all()
    )
    if not candidates:
        return None, None

    def dist(pair):
        d = pair[0]
        return haversine_km(lat, lng, float(d.current_lat), float(d.current_lng))

    if preferred_type:
        typed = [c for c in candidates if c[1].vehicle_type == preferred_type]
        if typed:
            return min(typed, key=dist)
    return min(candidates, key=dist)


def find_driver_any(db: Session, lat: float, lng: float):
    """DRIVER_RENTAL: any available driver; the passenger supplies the car."""
    candidates = _available_driver_query(db).all()
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda d: haversine_km(lat, lng, float(d.current_lat), float(d.current_lng)),
    )


def _get_trip(db: Session, trip_id: int) -> models.Trip:
    trip = db.query(models.Trip).options(*TRIP_LOAD).filter(models.Trip.trip_id == trip_id).first()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return trip


# ------------------------------------------------------------
# Fare estimate (no trip created)
# ------------------------------------------------------------

@router.post("/estimate", response_model=schemas.FareEstimateOut)
def estimate_fare(
    payload: schemas.FareEstimateIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    night = is_night()
    st = payload.service_type.upper()

    if st == "DRIVER_RENTAL":
        if payload.duration_hours is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "duration_hours required for DRIVER_RENTAL")
        b = calculate_rental_fare(float(payload.duration_hours), night)
        return schemas.FareEstimateOut(service_type=st, billed_hours=b["billed_hours"], **{k: v for k, v in b.items() if k != "billed_hours"})

    if payload.drop_lat is None or payload.drop_lng is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "drop coordinates required")

    distance = haversine_km(float(payload.pickup_lat), float(payload.pickup_lng), float(payload.drop_lat), float(payload.drop_lng))
    surge = compute_surge_multiplier(db)
    b = calculate_ride_fare(distance, payload.preferred_vehicle_type, surge, night, is_tour=(st == "TOUR"))
    return schemas.FareEstimateOut(service_type=st, distance_km=Decimal(str(round(distance, 2))), **b)


# ------------------------------------------------------------
# Booking: RIDE
# ------------------------------------------------------------

@router.post("", response_model=schemas.TripOut, status_code=status.HTTP_201_CREATED)
def request_ride(
    payload: schemas.RideRequestIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not current_user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is suspended")

    distance = haversine_km(float(payload.pickup_lat), float(payload.pickup_lng), float(payload.drop_lat), float(payload.drop_lng))
    night = is_night()
    surge = compute_surge_multiplier(db)

    driver, vehicle = find_driver_with_vehicle(db, float(payload.pickup_lat), float(payload.pickup_lng), payload.preferred_vehicle_type)
    vtype = vehicle.vehicle_type if vehicle else payload.preferred_vehicle_type
    b = calculate_ride_fare(distance, vtype, surge, night)

    trip = models.Trip(
        user_id=current_user.user_id,
        driver_id=driver.driver_id if driver else None,
        vehicle_id=vehicle.vehicle_id if vehicle else None,
        service_type="RIDE",
        pickup_location=payload.pickup_location, pickup_lat=payload.pickup_lat, pickup_lng=payload.pickup_lng,
        drop_location=payload.drop_location, drop_lat=payload.drop_lat, drop_lng=payload.drop_lng,
        distance_km=round(distance, 2),
        fare=b["fare"],
        surge_multiplier=b["surge_multiplier"],
        vehicle_type_multiplier=b["vehicle_type_multiplier"],
        night_surcharge=b["night_surcharge"],
        trip_status="REQUESTED",
    )
    db.add(trip); db.commit(); db.refresh(trip)
    return _get_trip(db, trip.trip_id)


# ------------------------------------------------------------
# Booking: TOUR (ride to an attraction + guide fee)
# ------------------------------------------------------------

@router.post("/tour", response_model=schemas.TripOut, status_code=status.HTTP_201_CREATED)
def request_tour(
    payload: schemas.TourRequestIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not current_user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is suspended")

    attraction = db.query(models.Attraction).filter(models.Attraction.attraction_id == payload.attraction_id).first()
    if not attraction:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attraction not found")

    distance = haversine_km(float(payload.pickup_lat), float(payload.pickup_lng), float(attraction.latitude), float(attraction.longitude))
    night = is_night()
    surge = compute_surge_multiplier(db)

    driver, vehicle = find_driver_with_vehicle(db, float(payload.pickup_lat), float(payload.pickup_lng), payload.preferred_vehicle_type)
    vtype = vehicle.vehicle_type if vehicle else payload.preferred_vehicle_type
    b = calculate_ride_fare(distance, vtype, surge, night, is_tour=True)

    trip = models.Trip(
        user_id=current_user.user_id,
        driver_id=driver.driver_id if driver else None,
        vehicle_id=vehicle.vehicle_id if vehicle else None,
        attraction_id=attraction.attraction_id,
        service_type="TOUR",
        pickup_location=payload.pickup_location, pickup_lat=payload.pickup_lat, pickup_lng=payload.pickup_lng,
        drop_location=attraction.name, drop_lat=attraction.latitude, drop_lng=attraction.longitude,
        distance_km=round(distance, 2),
        fare=b["fare"],
        surge_multiplier=b["surge_multiplier"],
        vehicle_type_multiplier=b["vehicle_type_multiplier"],
        night_surcharge=b["night_surcharge"],
        trip_status="REQUESTED",
    )
    db.add(trip); db.commit(); db.refresh(trip)
    return _get_trip(db, trip.trip_id)


# ------------------------------------------------------------
# Booking: DRIVER_RENTAL (driver drives the passenger's own car)
# ------------------------------------------------------------

@router.post("/rental", response_model=schemas.TripOut, status_code=status.HTTP_201_CREATED)
def request_rental(
    payload: schemas.RentalRequestIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not current_user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account is suspended")

    uv = db.query(models.UserVehicle).filter(
        models.UserVehicle.user_vehicle_id == payload.user_vehicle_id,
        models.UserVehicle.user_id == current_user.user_id,
    ).first()
    if not uv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found -- add it under 'My vehicles' first")

    distance = haversine_km(float(payload.pickup_lat), float(payload.pickup_lng), float(payload.drop_lat), float(payload.drop_lng))
    night = is_night()
    b = calculate_rental_fare(float(payload.duration_hours), night)

    driver = find_driver_any(db, float(payload.pickup_lat), float(payload.pickup_lng))

    trip = models.Trip(
        user_id=current_user.user_id,
        driver_id=driver.driver_id if driver else None,
        user_vehicle_id=uv.user_vehicle_id,
        service_type="DRIVER_RENTAL",
        pickup_location=payload.pickup_location, pickup_lat=payload.pickup_lat, pickup_lng=payload.pickup_lng,
        drop_location=payload.drop_location, drop_lat=payload.drop_lat, drop_lng=payload.drop_lng,
        distance_km=round(distance, 2),
        duration_hours=b["billed_hours"],
        fare=b["fare"],
        surge_multiplier=Decimal("1.00"),
        vehicle_type_multiplier=Decimal("1.00"),
        night_surcharge=night,
        trip_status="REQUESTED",
    )
    db.add(trip); db.commit(); db.refresh(trip)
    return _get_trip(db, trip.trip_id)


# ------------------------------------------------------------
# History
# ------------------------------------------------------------

@router.get("/my", response_model=list[schemas.TripOut])
def my_trips(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return (
        db.query(models.Trip).options(*TRIP_LOAD)
        .filter(models.Trip.user_id == current_user.user_id)
        .order_by(models.Trip.created_at.desc()).all()
    )


@router.get("/driver/assigned", response_model=list[schemas.TripOut])
def driver_assigned(db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    return (
        db.query(models.Trip).options(*TRIP_LOAD)
        .filter(models.Trip.driver_id == current_driver.driver_id)
        .order_by(models.Trip.created_at.desc()).all()
    )


@router.get("/{trip_id}", response_model=schemas.TripOut)
def get_trip(trip_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    trip = _get_trip(db, trip_id)
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    return trip


# ------------------------------------------------------------
# Lifecycle
# ------------------------------------------------------------

def _driver_owns(trip: models.Trip, driver: models.Driver):
    if trip.driver_id != driver.driver_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This trip is not assigned to you")


@router.patch("/{trip_id}/accept", response_model=schemas.TripOut)
def accept_trip(trip_id: int, db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    trip = _get_trip(db, trip_id); _driver_owns(trip, current_driver)
    if trip.trip_status != "REQUESTED":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip is already {trip.trip_status}")
    trip.trip_status = "ACCEPTED"
    db.commit(); db.refresh(trip)
    return trip


@router.patch("/{trip_id}/reject", response_model=schemas.TripOut)
def reject_trip(trip_id: int, db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    """Driver declines; trip goes back to unassigned so it can be re-matched."""
    trip = _get_trip(db, trip_id); _driver_owns(trip, current_driver)
    if trip.trip_status != "REQUESTED":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot reject a trip that is {trip.trip_status}")

    # Try to re-match to someone else
    if trip.service_type == "DRIVER_RENTAL":
        nxt = find_driver_any(db, float(trip.pickup_lat), float(trip.pickup_lng))
        others = [d for d in _available_driver_query(db).all() if d.driver_id != current_driver.driver_id]
        nxt = min(others, key=lambda d: haversine_km(float(trip.pickup_lat), float(trip.pickup_lng), float(d.current_lat), float(d.current_lng))) if others else None
        trip.driver_id = nxt.driver_id if nxt else None
    else:
        d, v = find_driver_with_vehicle(db, float(trip.pickup_lat), float(trip.pickup_lng), None)
        if d and d.driver_id == current_driver.driver_id:
            d, v = None, None
        trip.driver_id = d.driver_id if d else None
        trip.vehicle_id = v.vehicle_id if v else None
    db.commit(); db.refresh(trip)
    return trip


@router.patch("/{trip_id}/start", response_model=schemas.TripOut)
def start_trip(trip_id: int, db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    trip = _get_trip(db, trip_id); _driver_owns(trip, current_driver)
    if trip.trip_status != "ACCEPTED":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip must be ACCEPTED first (currently {trip.trip_status})")
    trip.trip_status = "ONGOING"; trip.start_time = datetime.now(timezone.utc)
    db.commit(); db.refresh(trip)
    return trip


@router.patch("/{trip_id}/complete", response_model=schemas.TripOut)
def complete_trip(trip_id: int, db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    trip = _get_trip(db, trip_id); _driver_owns(trip, current_driver)
    if trip.trip_status != "ONGOING":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip must be ONGOING first (currently {trip.trip_status})")
    trip.trip_status = "COMPLETED"; trip.end_time = datetime.now(timezone.utc)

    # Driver goes back to available automatically after finishing
    current_driver.availability_status = True
    db.commit(); db.refresh(trip)
    return trip


@router.patch("/{trip_id}/cancel", response_model=schemas.TripOut)
def cancel_trip(
    trip_id: int,
    payload: schemas.CancelTripIn | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    trip = _get_trip(db, trip_id)
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    if trip.trip_status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Trip is already {trip.trip_status}")
    if trip.trip_status == "ONGOING":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot cancel a trip that is already in progress")

    trip.trip_status = "CANCELLED"
    trip.cancellation_reason = (payload.reason if payload else None)

    # Simple rule-based fraud flag: 3+ cancellations in the user's last 10 trips
    recent = (
        db.query(models.Trip).filter(models.Trip.user_id == current_user.user_id)
        .order_by(models.Trip.created_at.desc()).limit(10).all()
    )
    if sum(1 for t in recent if t.trip_status == "CANCELLED") >= 3:
        current_user.is_flagged = True

    db.commit(); db.refresh(trip)
    return trip