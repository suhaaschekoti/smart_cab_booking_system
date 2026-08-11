from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class AttractionOut(BaseModel):
    attraction_id: int
    name: str
    description: str | None = None
    city: str | None = None
    category: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    created_at: datetime

    class Config:
        from_attributes = True  # lets this read directly from a SQLAlchemy model instance


# Add more Out/In schemas here as routes are built, e.g.:
# class UserOut(BaseModel):
#     user_id: int
#     name: str
#     email: str
#     ...
#     class Config:
#         from_attributes = True
