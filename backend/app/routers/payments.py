from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.pricing import REWARD_POINTS_PER_TRIP, compute_reward_discount
from app.routers.auth import get_current_user

router = APIRouter()

VALID_PAYMENT_MODES = {"WALLET", "CARD", "UPI", "CASH"}
DRIVER_INCENTIVE_PER_TRIP = Decimal("5.00")


@router.post("/{trip_id}", response_model=schemas.PaymentOut, status_code=status.HTTP_201_CREATED)
def make_payment(
    trip_id: int,
    payload: schemas.PaymentIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    mode = payload.payment_mode.upper()
    if mode not in VALID_PAYMENT_MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid payment mode. Choose from: {', '.join(sorted(VALID_PAYMENT_MODES))}")

    trip = db.query(models.Trip).filter(models.Trip.trip_id == trip_id).first()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    if trip.trip_status != "COMPLETED":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Payment is only allowed for COMPLETED trips (current: {trip.trip_status})")
    if db.query(models.Payment).filter(models.Payment.trip_id == trip_id).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Payment already processed for this trip")

    # Reward redemption
    discount, points_used = compute_reward_discount(trip.fare, current_user.reward_points or 0, payload.points_to_redeem)
    amount_due = (trip.fare - discount).quantize(Decimal("0.01"))

    payment = models.Payment(
        trip_id=trip_id,
        amount=amount_due,
        discount_applied=discount,
        points_redeemed=points_used,
        payment_mode=mode,
        payment_status="SUCCESS",
        payment_time=datetime.now(timezone.utc),
    )
    db.add(payment)

    # Ledger: debit redeemed points, credit earned points
    if points_used:
        current_user.reward_points -= points_used
        db.add(models.RewardTransaction(user_id=current_user.user_id, trip_id=trip_id, points_change=-points_used, reason="redeemed_discount"))
    current_user.reward_points = (current_user.reward_points or 0) + REWARD_POINTS_PER_TRIP
    db.add(models.RewardTransaction(user_id=current_user.user_id, trip_id=trip_id, points_change=REWARD_POINTS_PER_TRIP, reason="trip_completed"))

    # Driver incentive
    if trip.driver_id:
        driver = db.query(models.Driver).filter(models.Driver.driver_id == trip.driver_id).first()
        if driver:
            driver.incentive_score = (driver.incentive_score or Decimal("0")) + DRIVER_INCENTIVE_PER_TRIP

    db.commit(); db.refresh(payment)
    return payment


@router.get("/{trip_id}/receipt", response_model=schemas.PaymentOut)
def get_receipt(trip_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    trip = db.query(models.Trip).filter(models.Trip.trip_id == trip_id).first()
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    payment = db.query(models.Payment).filter(models.Payment.trip_id == trip_id).first()
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No payment found for this trip yet")
    return payment