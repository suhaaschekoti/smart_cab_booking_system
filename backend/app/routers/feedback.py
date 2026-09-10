from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.auth import get_current_user

router = APIRouter()


def recalculate_driver_rating(db: Session, driver_id: int) -> None:
    """
    Recomputes the driver's average rating from all feedback rows
    linked to their trips and saves it back to drivers.rating.
    Called every time new feedback is submitted.
    """
    avg = (
        db.query(func.avg(models.Feedback.rating))
        .join(models.Trip, models.Trip.trip_id == models.Feedback.trip_id)
        .filter(models.Trip.driver_id == driver_id)
        .scalar()
    )
    if avg is not None:
        driver = db.query(models.Driver).filter(
            models.Driver.driver_id == driver_id
        ).first()
        if driver:
            driver.rating = round(float(avg), 1)
            db.commit()


@router.post("/{trip_id}", response_model=schemas.FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    trip_id: int,
    payload: schemas.FeedbackIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Validate rating range
    if not 1 <= payload.rating <= 5:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rating must be between 1 and 5")

    # Trip must exist, belong to this passenger, and be paid
    trip = db.query(models.Trip).filter(models.Trip.trip_id == trip_id).first()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    if trip.trip_status != "COMPLETED":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Feedback can only be submitted for COMPLETED trips",
        )

    # Must have paid first
    payment = db.query(models.Payment).filter(
        models.Payment.trip_id == trip_id,
        models.Payment.payment_status == "SUCCESS",
    ).first()
    if not payment:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Please complete payment before submitting feedback",
        )

    # One feedback per trip
    existing = db.query(models.Feedback).filter(
        models.Feedback.trip_id == trip_id
    ).first()
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Feedback already submitted for this trip",
        )

    feedback = models.Feedback(
        trip_id=trip_id,
        rating=payload.rating,
        comments=payload.comments,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    # Update the driver's average rating
    if trip.driver_id:
        recalculate_driver_rating(db, trip.driver_id)

    return feedback


@router.get("/{trip_id}", response_model=schemas.FeedbackOut)
def get_feedback(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = db.query(models.Trip).filter(models.Trip.trip_id == trip_id).first()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")

    feedback = db.query(models.Feedback).filter(
        models.Feedback.trip_id == trip_id
    ).first()
    if not feedback:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No feedback submitted for this trip yet")

    return feedback