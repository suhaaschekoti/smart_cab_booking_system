from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.routers.auth import get_current_admin

router = APIRouter()

TRIP_LOAD = [joinedload(models.Trip.driver), joinedload(models.Trip.attraction), joinedload(models.Trip.user)]


@router.get("/stats", response_model=schemas.AdminStatsOut)
def stats(db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    revenue = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(models.Payment.payment_status == "SUCCESS").scalar()
    avg_rating = db.query(func.avg(models.Driver.rating)).scalar()
    return schemas.AdminStatsOut(
        total_users=db.query(models.User).count(),
        total_drivers=db.query(models.Driver).count(),
        active_drivers=db.query(models.Driver).filter(models.Driver.availability_status.is_(True)).count(),
        total_trips=db.query(models.Trip).count(),
        completed_trips=db.query(models.Trip).filter(models.Trip.trip_status == "COMPLETED").count(),
        cancelled_trips=db.query(models.Trip).filter(models.Trip.trip_status == "CANCELLED").count(),
        ongoing_trips=db.query(models.Trip).filter(models.Trip.trip_status.in_(["ACCEPTED", "ONGOING"])).count(),
        total_revenue=Decimal(str(revenue)),
        total_alerts=db.query(models.SafetyAlert).count(),
        open_alerts=db.query(models.SafetyAlert).filter(models.SafetyAlert.alert_status == "SENT").count(),
        avg_driver_rating=float(avg_rating) if avg_rating is not None else None,
    )


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.get("/drivers", response_model=list[schemas.DriverOut])
def list_drivers(db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    return db.query(models.Driver).order_by(models.Driver.created_at.desc()).all()


@router.get("/trips", response_model=list[schemas.TripOut])
def list_trips(db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin), limit: int = 200):
    return db.query(models.Trip).options(*TRIP_LOAD).order_by(models.Trip.created_at.desc()).limit(limit).all()


@router.get("/payments", response_model=list[schemas.PaymentOut])
def list_payments(db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin), limit: int = 200):
    return db.query(models.Payment).order_by(models.Payment.payment_time.desc()).limit(limit).all()


@router.get("/alerts", response_model=list[schemas.SafetyAlertOut])
def list_alerts(db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    return db.query(models.SafetyAlert).options(joinedload(models.SafetyAlert.notifications)).order_by(models.SafetyAlert.alert_time.desc()).all()


@router.patch("/alerts/{alert_id}/acknowledge", response_model=schemas.SafetyAlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    a = db.query(models.SafetyAlert).options(joinedload(models.SafetyAlert.notifications)).filter(models.SafetyAlert.alert_id == alert_id).first()
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    a.alert_status = "ACKNOWLEDGED"
    db.commit(); db.refresh(a)
    return a


@router.patch("/users/{user_id}/active", response_model=schemas.UserOut)
def set_user_active(user_id: int, payload: schemas.AdminToggleIn, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    u = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    u.is_active = payload.value; db.commit(); db.refresh(u)
    return u


@router.patch("/users/{user_id}/flag", response_model=schemas.UserOut)
def set_user_flag(user_id: int, payload: schemas.AdminToggleIn, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    u = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    u.is_flagged = payload.value; db.commit(); db.refresh(u)
    return u


@router.patch("/drivers/{driver_id}/active", response_model=schemas.DriverOut)
def set_driver_active(driver_id: int, payload: schemas.AdminToggleIn, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    d = db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Driver not found")
    d.is_active = payload.value
    if not payload.value:
        d.availability_status = False
    db.commit(); db.refresh(d)
    return d


@router.patch("/drivers/{driver_id}/verify", response_model=schemas.DriverOut)
def set_driver_verified(driver_id: int, payload: schemas.AdminToggleIn, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    """Admin can manually verify a driver (e.g. after checking their license) without the email flow."""
    d = db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Driver not found")
    d.is_verified = payload.value; db.commit(); db.refresh(d)
    return d


@router.post("/attractions", response_model=schemas.AttractionOut, status_code=status.HTTP_201_CREATED)
def add_attraction(payload: schemas.AttractionIn, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    a = models.Attraction(**payload.model_dump()); db.add(a); db.commit(); db.refresh(a)
    return a


@router.delete("/attractions/{attraction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attraction(attraction_id: int, db: Session = Depends(get_db), _: models.Admin = Depends(get_current_admin)):
    a = db.query(models.Attraction).filter(models.Attraction.attraction_id == attraction_id).first()
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attraction not found")
    db.delete(a); db.commit()