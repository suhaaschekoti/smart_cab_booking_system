"""
Trip-related calculations: distance and fare.

Kept deliberately simple for this project's scope -- straight-line
(Haversine) distance rather than real routing, and a flat per-km fare
rather than real-time surge pricing. See README "Scope Notes" for why.
"""
import math
from decimal import Decimal

EARTH_RADIUS_KM = 6371.0

BASE_FARE = Decimal("40.00")       # flat pickup charge
PER_KM_RATE = Decimal("12.00")     # charge per km travelled
MINIMUM_FARE = Decimal("60.00")    # floor, so very short trips aren't free


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance between two lat/lng points, in kilometers."""
    lat1_r, lng1_r, lat2_r, lng2_r = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_KM * c


def calculate_fare(distance_km: float) -> Decimal:
    """
    fare = base_fare + (distance_km * per_km_rate), floored at MINIMUM_FARE.
    Rounded to 2 decimal places to match the `fare` column's DECIMAL(8,2).
    """
    raw_fare = BASE_FARE + (Decimal(str(distance_km)) * PER_KM_RATE)
    fare = max(raw_fare, MINIMUM_FARE)
    return fare.quantize(Decimal("0.01"))