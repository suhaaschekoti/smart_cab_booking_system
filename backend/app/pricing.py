"""
Pricing engine for all three service types.

RIDE / TOUR:  base + per-km, adjusted by vehicle type, night surcharge,
              and demand-based surge (ratio of pending requests to
              available drivers).
DRIVER_RENTAL: hourly rate (passenger's own car), minimum 2 hours,
              night surcharge applies.

All of this is straight-line (Haversine) distance -- no real routing.
Constants are deliberately exposed at module level so they're easy to
tweak or cite in the report.
"""
import math
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app import models

EARTH_RADIUS_KM = 6371.0

# ---- RIDE / TOUR ----
BASE_FARE = Decimal("40.00")
PER_KM_RATE = Decimal("12.00")
MINIMUM_FARE = Decimal("60.00")
TOUR_GUIDE_FEE = Decimal("100.00")   # flat add-on for TOUR trips

# ---- DRIVER_RENTAL ----
RENTAL_HOURLY_RATE = Decimal("150.00")
RENTAL_MINIMUM_HOURS = Decimal("2.00")
RENTAL_BASE_FEE = Decimal("50.00")   # covers driver reaching the pickup point

# ---- Multipliers ----
VEHICLE_TYPE_MULTIPLIER = {
    "Hatchback": Decimal("1.00"),
    "Sedan":     Decimal("1.20"),
    "SUV":       Decimal("1.50"),
}
NIGHT_SURCHARGE_MULTIPLIER = Decimal("1.25")   # 10pm-6am
NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 6

SURGE_MAX = Decimal("2.00")          # never more than 2x
SURGE_STEP = Decimal("0.25")         # +0.25x per unit of demand/supply ratio above 1

# ---- Rewards ----
REWARD_POINTS_PER_TRIP = 10
POINT_VALUE_RUPEES = Decimal("1.00")           # 1 point = ₹1
MAX_DISCOUNT_FRACTION = Decimal("0.50")        # points can cover at most 50% of fare


def _q(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    lat1_r, lng1_r, lat2_r, lng2_r = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


def is_night(now: datetime | None = None) -> bool:
    hour = (now or datetime.now()).hour
    return hour >= NIGHT_START_HOUR or hour < NIGHT_END_HOUR


def compute_surge_multiplier(db: Session) -> Decimal:
    """
    Demand-based surge: pending REQUESTED trips vs. available drivers.
    ratio <= 1 -> no surge.  Each unit above 1 adds SURGE_STEP, capped at SURGE_MAX.
    If there are no available drivers at all, treat as maximum surge --
    the request will be created unmatched, and the price reflects scarcity.
    """
    pending = (
        db.query(models.Trip)
        .filter(models.Trip.trip_status == "REQUESTED")
        .count()
    )
    available = (
        db.query(models.Driver)
        .filter(models.Driver.availability_status.is_(True))
        .filter(models.Driver.is_active.is_(True))
        .count()
    )
    if available == 0:
        return SURGE_MAX
    ratio = Decimal(pending) / Decimal(available)
    if ratio <= 1:
        return Decimal("1.00")
    surge = Decimal("1.00") + (ratio - 1) * SURGE_STEP
    return _q(min(surge, SURGE_MAX))


def vehicle_multiplier(vehicle_type: str | None) -> Decimal:
    return VEHICLE_TYPE_MULTIPLIER.get(vehicle_type or "", Decimal("1.00"))


def calculate_ride_fare(
    distance_km: float,
    vehicle_type: str | None,
    surge: Decimal,
    night: bool,
    is_tour: bool = False,
) -> dict:
    """
    Returns a breakdown dict so the receipt can explain the fare.
    """
    base = BASE_FARE + Decimal(str(distance_km)) * PER_KM_RATE
    base = max(base, MINIMUM_FARE)

    vmult = vehicle_multiplier(vehicle_type)
    nmult = NIGHT_SURCHARGE_MULTIPLIER if night else Decimal("1.00")

    subtotal = base * vmult * nmult * surge
    tour_fee = TOUR_GUIDE_FEE if is_tour else Decimal("0.00")
    total = _q(subtotal + tour_fee)

    return {
        "base_fare": _q(base),
        "vehicle_type_multiplier": vmult,
        "night_surcharge": night,
        "surge_multiplier": surge,
        "tour_guide_fee": tour_fee,
        "fare": total,
    }


def calculate_rental_fare(duration_hours: float, night: bool) -> dict:
    hours = max(Decimal(str(duration_hours)), RENTAL_MINIMUM_HOURS)
    nmult = NIGHT_SURCHARGE_MULTIPLIER if night else Decimal("1.00")
    total = _q((RENTAL_BASE_FEE + hours * RENTAL_HOURLY_RATE) * nmult)
    return {
        "base_fare": _q(RENTAL_BASE_FEE + hours * RENTAL_HOURLY_RATE),
        "billed_hours": hours,
        "vehicle_type_multiplier": Decimal("1.00"),
        "night_surcharge": night,
        "surge_multiplier": Decimal("1.00"),
        "fare": total,
    }


def compute_reward_discount(fare: Decimal, points_available: int, points_to_use: int) -> tuple[Decimal, int]:
    """
    Returns (discount_rupees, points_actually_used). Caps at the user's
    balance and at MAX_DISCOUNT_FRACTION of the fare.
    """
    if points_to_use <= 0 or points_available <= 0:
        return Decimal("0.00"), 0
    usable = min(points_to_use, points_available)
    max_discount = _q(fare * MAX_DISCOUNT_FRACTION)
    discount = min(Decimal(usable) * POINT_VALUE_RUPEES, max_discount)
    points_used = int(discount / POINT_VALUE_RUPEES)
    return _q(discount), points_used