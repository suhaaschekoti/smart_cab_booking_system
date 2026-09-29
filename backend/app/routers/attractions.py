from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import get_db
from app.pricing import haversine_km
from app.models import Attraction
from app.schemas import DynamicAttractionsResponse
import httpx
from pydantic import BaseModel
from typing import Optional,List
from app.ai_planner import generate_tour_itinerary
from app.overpass_utils import fetch_dynamic_attractions, calculate_haversine

router = APIRouter()

@router.get("/nearby", response_model=DynamicAttractionsResponse)
async def get_nearby_attractions(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(40.0, ge=1.0, le=150.0),
    db: Session = Depends(get_db)
):
    spots = []
    try:
        spots = await fetch_dynamic_attractions(lat=lat, lng=lng, radius_km=radius_km)
    except Exception as exc:
        spots = []

    # If Overpass endpoints time out or return empty, use local seeded spots
    if not spots:
        db_attractions = db.query(Attraction).all()
        for item in db_attractions:
            dist = calculate_haversine(lat, lng, float(item.latitude), float(item.longitude))
            spots.append({
                "id": getattr(item, "attraction_id", getattr(item, "id", 1)),
                "name": item.name,
                "category": item.category,
                "latitude": float(item.latitude),
                "longitude": float(item.longitude),
                "distance_km": dist,
                "description": item.description or f"Local attraction ~{dist} km away."
            })
        spots.sort(key=lambda x: x["distance_km"])

    return {
        "user_lat": lat,
        "user_lng": lng,
        "radius_km": radius_km,
        "count": len(spots),
        "attractions": spots
    }

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

class PlanTourRequest(BaseModel):
    prompt: str
    pickup_lat: float
    pickup_lng: float
    duration_hours: Optional[float] = 4.0

async def extract_and_geocode_city(prompt: str) -> Optional[tuple[float, float]]:
    """If user types 'in Mumbai' or 'near Karachi', geocode that city first."""
    keywords = ["in ", "near ", "around ", "at "]
    lowered = prompt.lower()
    city_candidate = None

    for kw in keywords:
        if kw in lowered:
            parts = lowered.split(kw)
            if len(parts) > 1:
                city_candidate = parts[-1].strip().strip(".?!,")
                break

    if not city_candidate:
        return None

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": city_candidate, "format": "json", "limit": 1},
                headers={"User-Agent": "SmartCabBookingSystem/1.0"}
            )
            if res.status_code == 200 and res.json():
                item = res.json()[0]
                return float(item["lat"]), float(item["lon"])
    except Exception:
        pass
    return None

@router.post("/plan")
async def plan_tour(req: PlanTourRequest, db: Session = Depends(get_db)):
    target_lat = req.pickup_lat
    target_lng = req.pickup_lng

    # 1. Check if user typed a specific city in the prompt
    detected_coords = await extract_and_geocode_city(req.prompt)
    if detected_coords:
        target_lat, target_lng = detected_coords

    # 2. Fetch real spots around the determined location
    candidate_spots = []
    try:
        candidate_spots = await fetch_dynamic_attractions(
            lat=target_lat,
            lng=target_lng,
            radius_km=35.0
        )
    except Exception:
        candidate_spots = []

    # 3. Fallback to DB if no online candidates found
    if not candidate_spots:
        db_attractions = db.query(Attraction).all()
        for item in db_attractions:
            dist = calculate_haversine(target_lat, target_lng, float(item.latitude), float(item.longitude))
            candidate_spots.append({
                "id": getattr(item, "attraction_id", getattr(item, "id", 1)),
                "name": item.name,
                "category": item.category,
                "latitude": float(item.latitude),
                "longitude": float(item.longitude),
                "distance_km": dist,
                "description": item.description
            })

    # 4. Generate structured itinerary
    itinerary = await generate_tour_itinerary(
        user_prompt=req.prompt,
        pickup_coords={"lat": target_lat, "lng": target_lng},
        available_attractions=candidate_spots,
        duration_hours=req.duration_hours or 4.0
    )
    return itinerary