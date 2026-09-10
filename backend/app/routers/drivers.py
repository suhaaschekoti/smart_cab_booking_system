from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers import auth

router = APIRouter()


@router.get("/me", response_model=schemas.DriverOut)
def get_my_driver_profile(current_driver: models.Driver = Depends(auth.get_current_driver)):
    return current_driver


@router.get("/me/vehicle", response_model=list[dict])
def get_my_vehicle(db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    rows = db.query(models.Vehicle).filter(models.Vehicle.driver_id == current_driver.driver_id).all()
    return [{"vehicle_id": v.vehicle_id, "vehicle_number": v.vehicle_number, "vehicle_type": v.vehicle_type, "fuel_type": v.fuel_type} for v in rows]


@router.get("/me/stats")
def get_my_stats(db: Session = Depends(get_db), current_driver: models.Driver = Depends(auth.get_current_driver)):
    did = current_driver.driver_id
    completed = db.query(models.Trip).filter(models.Trip.driver_id == did, models.Trip.trip_status == "COMPLETED").count()
    earnings = (
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .join(models.Trip, models.Trip.trip_id == models.Payment.trip_id)
        .filter(models.Trip.driver_id == did, models.Payment.payment_status == "SUCCESS").scalar()
    )
    ratings_count = (
        db.query(models.Feedback).join(models.Trip, models.Trip.trip_id == models.Feedback.trip_id)
        .filter(models.Trip.driver_id == did).count()
    )
    return {
        "completed_trips": completed,
        "total_earnings": float(earnings or 0),
        "rating": float(current_driver.rating or 0),
        "ratings_count": ratings_count,
        "incentive_score": float(current_driver.incentive_score or 0),
    }


@router.patch("/me/availability", response_model=schemas.DriverOut)
def set_my_availability(
    payload: schemas.DriverAvailabilityIn,
    db: Session = Depends(get_db),
    current_driver: models.Driver = Depends(auth.get_current_driver),
):
    current_driver.availability_status = payload.availability_status
    if payload.current_lat is not None:
        current_driver.current_lat = payload.current_lat
    if payload.current_lng is not None:
        current_driver.current_lng = payload.current_lng
    db.commit(); db.refresh(current_driver)
    return current_driver