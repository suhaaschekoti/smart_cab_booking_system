import math
import time
import httpx
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# In-memory cache
_CACHE: Dict[Tuple[float, float, int], Tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL = 3600

def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)

def map_category(cls: str, osm_type: str) -> str:
    if cls in ["natural", "waterway"] or osm_type in ["waterfall", "beach", "peak"]:
        return "Nature"
    if cls in ["historic"] or osm_type in ["monument", "castle", "ruins", "archaeological_site"]:
        return "Historical"
    if osm_type in ["viewpoint"]:
        return "Adventure"
    if cls in ["tourism", "leisure"] or osm_type in ["museum", "gallery", "theme_park", "zoo"]:
        return "Culture"
    if cls in ["amenity"] and osm_type in ["place_of_worship"]:
        return "Culture"
    return "Tourist Attraction"

async def fetch_dynamic_attractions(lat: float, lng: float, radius_km: float = 40.0) -> List[Dict[str, Any]]:
    cache_key = (round(lat, 2), round(lng, 2), int(radius_km))
    now = time.time()

    if cache_key in _CACHE:
        timestamp, cached = _CACHE[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached

    delta_deg = radius_km / 111.0
    min_lat = lat - delta_deg
    max_lat = lat + delta_deg
    min_lng = lng - (delta_deg / math.cos(math.radians(lat)))
    max_lng = lng + (delta_deg / math.cos(math.radians(lat)))
    
    viewbox = f"{min_lng},{max_lat},{max_lng},{min_lat}"

    # Target specific historic, cultural, and scenic attractions
    queries = [
        "historic monument",
        "heritage site",
        "temple church",
        "tourist attraction",
        "waterfall viewpoint"
    ]
    results = []
    seen = set()

    headers = {
        "User-Agent": "SmartCabBookingSystem/1.0 (academic-project; contact@cabdemo.local)"
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        for q in queries:
            try:
                params = {
                    "q": q,
                    "format": "json",
                    "viewbox": viewbox,
                    "bounded": 1,
                    "limit": 15,
                    "addressdetails": 1
                }
                res = await client.get(NOMINATIM_URL, params=params, headers=headers)
                if res.status_code == 200:
                    items = res.json()
                    for item in items:
                        addr = item.get("address", {})
                        city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or "Nearby"
                        
                        raw_name = item.get("name") or item.get("display_name", "").split(",")[0].strip()
                        osm_class = item.get("class", "")
                        osm_type = item.get("type", "")

                        # Filter out highway/road artifacts, pure admin boundaries, and generic city-center labels
                        if (
                            not raw_name
                            or len(raw_name) < 4
                            or raw_name.lower() in [city.lower(), "kottayam", "mumbai", "karachi", "india"]
                            or osm_class in ["highway", "road", "boundary", "place", "administrative"]
                            or raw_name in seen
                        ):
                            continue

                        spot_lat = float(item["lat"])
                        spot_lng = float(item["lon"])
                        dist = calculate_haversine(lat, lng, spot_lat, spot_lng)

                        if dist > radius_km:
                            continue

                        seen.add(raw_name)
                        category = map_category(osm_class, osm_type)

                        results.append({
                            "id": item.get("place_id"),
                            "name": raw_name,
                            "category": category,
                            "city": city,
                            "latitude": spot_lat,
                            "longitude": spot_lng,
                            "distance_km": dist,
                            "description": f"Historic & cultural spot located in {city}, ~{dist} km away."
                        })
            except Exception as e:
                logger.warning(f"Discovery query error for '{q}': {e}")
                continue

    results.sort(key=lambda x: x["distance_km"])
    if results:
        _CACHE[cache_key] = (now, results)
    return results