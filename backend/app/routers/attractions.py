from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.pricing import haversine_km

router = APIRouter()


@router.get("", response_model=list[schemas.AttractionOut])
def list_attractions(
    db: Session = Depends(get_db),
    city: str | None = None,
    category: str | None = None,
    near_lat: float | None = Query(None),
    near_lng: float | None = Query(None),
    radius_km: float = Query(50.0),
):
    """Public. Optionally filter by city/category, or by distance from a point."""
    q = db.query(models.Attraction)
    if city:
        q = q.filter(models.Attraction.city.ilike(f"%{city}%"))
    if category:
        q = q.filter(models.Attraction.category.ilike(category))
    rows = q.order_by(models.Attraction.name).all()

    if near_lat is not None and near_lng is not None:
        rows = [
            a for a in rows
            if a.latitude is not None and a.longitude is not None
            and haversine_km(near_lat, near_lng, float(a.latitude), float(a.longitude)) <= radius_km
        ]
        rows.sort(key=lambda a: haversine_km(near_lat, near_lng, float(a.latitude), float(a.longitude)))
    return rows


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    return [r[0] for r in db.query(models.Attraction.category).distinct().all() if r[0]]