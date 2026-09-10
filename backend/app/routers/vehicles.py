from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("", response_model=list[schemas.UserVehicleOut])
def list_my_vehicles(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.UserVehicle).filter(models.UserVehicle.user_id == current_user.user_id).all()


@router.post("", response_model=schemas.UserVehicleOut, status_code=status.HTTP_201_CREATED)
def add_vehicle(payload: schemas.UserVehicleIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    v = models.UserVehicle(user_id=current_user.user_id, **payload.model_dump())
    db.add(v); db.commit(); db.refresh(v)
    return v


@router.delete("/{user_vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(user_vehicle_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    v = db.query(models.UserVehicle).filter(
        models.UserVehicle.user_vehicle_id == user_vehicle_id,
        models.UserVehicle.user_id == current_user.user_id,
    ).first()
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")
    in_use = db.query(models.Trip).filter(
        models.Trip.user_vehicle_id == user_vehicle_id,
        models.Trip.trip_status.in_(["REQUESTED", "ACCEPTED", "ONGOING"]),
    ).first()
    if in_use:
        raise HTTPException(status.HTTP_409_CONFLICT, "Vehicle is used by an active rental")
    db.delete(v); db.commit()