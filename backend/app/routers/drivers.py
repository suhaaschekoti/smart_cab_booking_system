from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers import auth

router = APIRouter()


@router.get("/me", response_model=schemas.DriverOut)
def get_my_driver_profile(current_driver: models.Driver = Depends(auth.get_current_driver)):
    return current_driver


@router.patch("/me/availability", response_model=schemas.DriverOut)
def set_my_availability(
    payload: schemas.DriverAvailabilityIn,
    db: Session = Depends(get_db),
    current_driver: models.Driver = Depends(auth.get_current_driver),
):
    """
    Toggle online/offline, and optionally update current location in the
    same call -- e.g. the frontend can send { availability_status: true,
    current_lat, current_lng } together when a driver goes online, since
    a driver with no location can never be matched (see trips.py matching).
    """
    current_driver.availability_status = payload.availability_status
    if payload.current_lat is not None:
        current_driver.current_lat = payload.current_lat
    if payload.current_lng is not None:
        current_driver.current_lng = payload.current_lng

    db.commit()
    db.refresh(current_driver)
    return current_driver