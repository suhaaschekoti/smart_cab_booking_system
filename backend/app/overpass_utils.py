import math
import time
import httpx
import asyncio
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# In-memory cache
_CACHE: Dict[Tuple[float, float, int], Tuple[float, List[Dict[str, Any]]]] = {}
CACHE_TTL = 3600

EXCLUDED_NAME_KEYWORDS = {
    "hotel",
    "guest house",
    "guesthouse",
    "homestay",
    "tourist home",
    "resort",
    "lodge",
    "hostel",
    "restaurant",
    "cafe",
    "shop",
    "store",
    "school",
    "college",
    "hospital",
    "office",
    "apartment"
}

GENERIC_NAMES = {
    "temple",
    "church",
    "mosque",
    "shrine",
    "park",
    "museum",
    "monument",
    "viewpoint",
    "beach",
    "waterfall",
    "lake",
    "fort",
    "castle",
    "palace"
}

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

async def fetch_dynamic_attractions(
    lat: float,
    lng: float,
    radius_km: float = 40.0
) -> List[Dict[str, Any]]:
    cache_key = (
        round(lat, 4),
        round(lng, 4),
        int(radius_km)
    )

    now = time.time()

    if cache_key in _CACHE:
        timestamp, cached = _CACHE[cache_key]

        if now - timestamp < CACHE_TTL:
            return cached

    delta_deg = radius_km / 111.0

    min_lat = lat - delta_deg
    max_lat = lat + delta_deg

    cos_lat = math.cos(math.radians(lat))

    if abs(cos_lat) < 0.01:
        return []

    delta_lng = delta_deg / cos_lat

    min_lng = lng - delta_lng
    max_lng = lng + delta_lng

    viewbox = (
        f"{min_lng},{max_lat},"
        f"{max_lng},{min_lat}"
    )

    headers = {
        "User-Agent": (
            "SmartCabBookingSystem/1.0 "
            "(academic-project)"
        )
    }

    queries = [
        "tourist attraction",
        "heritage site",
        "historic monument",
        "temple",
        "church",
        "palace",
        "beach",
        "park",
        "waterfall",
        "viewpoint",
        "museum",
        "memorial",
        "aquarium",
        "zoo",
        "bird sanctuary"
    ]

    items = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for index, query in enumerate(queries):
            try:
                params = {
                    "q": query,
                    "format": "jsonv2",
                    "viewbox": viewbox,
                    "bounded": 1,
                    "layer": "poi,natural",
                    "limit": 10,
                    "addressdetails": 1,
                    "extratags": 1,
                    "accept-language": "en"
                }

                response = await client.get(
                    NOMINATIM_URL,
                    params=params,
                    headers=headers
                )

                response.raise_for_status()

                query_results = response.json()
                items.extend(query_results)

                logger.info(
                    f"Nominatim query '{query}' returned "
                    f"{len(query_results)} results"
                )

            except Exception as exc:
                logger.warning(
                    f"Nominatim query '{query}' failed: "
                    f"{type(exc).__name__}: {repr(exc)}"
                )

            if index < len(queries) - 1:
                await asyncio.sleep(1.1)

    results = []
    seen = set()
    seen_coordinates = []

    for item in items:
        raw_name = (
            item.get("name")
            or item.get(
                "display_name",
                ""
            ).split(",")[0]
        ).strip()

        if not raw_name:
            continue

        normalized_name = " ".join(
            raw_name.casefold().split()
        )

        if normalized_name in GENERIC_NAMES:
            continue

        if any(
            keyword in normalized_name
            for keyword in EXCLUDED_NAME_KEYWORDS
        ):
            continue

        if any(
            keyword in normalized_name
            for keyword in {
                "road",
                "junction",
                "bund road",
                "bus stop",
                "railway",
                "station",
                "stop",
                "project",
                "village road"
            }
        ):
            continue

        try:
            spot_lat = float(item["lat"])
            spot_lng = float(item["lon"])
        except (
            KeyError,
            TypeError,
            ValueError
        ):
            continue

        distance = calculate_haversine(
            lat,
            lng,
            spot_lat,
            spot_lng
        )

        if distance > radius_km:
            continue

        address = item.get("address", {})

        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("county")
            or "Nearby"
        )

        if normalized_name == city.casefold():
            continue

        osm_class = item.get(
            "class",
            ""
        )

        osm_type = item.get(
            "type",
            ""
        )

        if normalized_name in seen:
            continue

        is_duplicate_location = False

        for existing_lat, existing_lng in seen_coordinates:
            if calculate_haversine(
                spot_lat,
                spot_lng,
                existing_lat,
                existing_lng
            ) < 0.5:
                is_duplicate_location = True
                break

        if is_duplicate_location:
            continue

        extratags = item.get(
            "extratags",
            {}
        ) or {}

        try:
            importance = float(
                item.get(
                    "importance",
                    0.0
                ) or 0.0
            )
        except (
            TypeError,
            ValueError
        ):
            importance = 0.0

        description = str(
            extratags.get(
                "description",
                ""
            )
        ).strip()

        seen.add(normalized_name)

        seen_coordinates.append(
            (spot_lat, spot_lng)
        )

        results.append({
            "id": item.get("osm_id") or item.get("place_id"),
            "name": raw_name,
            "category": map_category(
                osm_class,
                osm_type
            ),
            "city": city,
            "latitude": spot_lat,
            "longitude": spot_lng,
            "distance_km": distance,
            "description": description,
            "_importance": importance
        })

    results.sort(
        key=lambda x: (
            -x["_importance"],
            x["distance_km"]
        )
    )

    for result in results:
        result.pop(
            "_importance",
            None
        )

    results = results[:20]

    if results:
        _CACHE[cache_key] = (
            now,
            results
        )

    return results