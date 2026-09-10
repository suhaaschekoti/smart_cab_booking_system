from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.pricing import POINT_VALUE_RUPEES, MAX_DISCOUNT_FRACTION
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/me", response_model=schemas.RewardSummaryOut)
def my_rewards(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    history = (
        db.query(models.RewardTransaction)
        .filter(models.RewardTransaction.user_id == current_user.user_id)
        .order_by(models.RewardTransaction.created_at.desc())
        .limit(50).all()
    )
    return schemas.RewardSummaryOut(
        reward_points=current_user.reward_points or 0,
        point_value_rupees=POINT_VALUE_RUPEES,
        max_discount_fraction=MAX_DISCOUNT_FRACTION,
        history=history,
    )