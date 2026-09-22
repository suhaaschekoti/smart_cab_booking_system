"""
Pricing engine for all three service types.

RIDE / TOUR:  per-vehicle base + per-km + per-minute (road-adjusted),
              adjusted by night/peak time multipliers and demand-based
              surge (ratio of pending requests to available drivers).
DRIVER_RENTAL: hourly rate (passenger's own car), minimum 2 hours,
              night/peak surcharge applies.

Distance is straight-line (Haversine) inflated by ROAD_CIRCUITY_FACTOR
to approximate road distance -- no real routing.
Constants are deliberately exposed at module level so they're easy to
tweak or cite in the report.
"""
import math
import time
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app import models

IST = ZoneInfo("Asia/Kolkata")

EARTH_RADIUS_KM = 6371.0

# ---- RIDE / TOUR (per vehicle type) ----
# Anchored to Sept 2025 govt-approved slabs that Uber/Ola/Rapido were
# ordered to charge (Pune: TOI 2025-09-22): base covers the first 3 km,
# then per-km beyond -- 10 km rides cost Hatch Rs280 / Sedan Rs310 /
# SUV Rs340. Mumbai MMRTA band is Rs17-34/km (base 22.72, surge to 1.5x),
# consistent with these slabs. Uber-style per-minute time charge
# (~Rs1-1.6/min, cf. Uber India Go/X rate cards) applies to minutes
# beyond the included 3 km (~6 min at 30 km/h); the base is assumed to
# already include that initial time, mirroring the govt all-in rates.
INCLUDED_KM = Decimal("3.00")
INCLUDED_MINUTES = Decimal("6.00")  # 3 km at AVG_SPEED_KMPH
BASE_FARE = {
    "Hatchback": Decimal("84.00"),
    "Sedan": Decimal("93.00"),
    "SUV": Decimal("102.00"),
}
PER_KM_RATE = {
    "Hatchback": Decimal("28.00"),
    "Sedan": Decimal("31.00"),
    "SUV": Decimal("34.00"),
}
PER_MINUTE_RATE = {
    "Hatchback": Decimal("1.00"),
    "Sedan": Decimal("1.25"),
    "SUV": Decimal("1.50"),
}
AVG_SPEED_KMPH = Decimal("30.00")  # used to estimate ride minutes from km
DEFAULT_VEHICLE_TYPE = "Hatchback"
VALID_VEHICLE_TYPES = frozenset({"Hatchback", "Sedan", "SUV"})
# Kept for backward-compat breakdowns: differentiation now lives in the
# per-type tables above, so the multiplier itself is always 1.00.
VEHICLE_TYPE_MULTIPLIER = {
    "Hatchback": Decimal("1.00"),
    "Sedan": Decimal("1.00"),
    "SUV": Decimal("1.00"),
}
# Per-type minimums: short trips (under the included 3 km) bill the base,
# matching the govt slab floor and Uber-style minimum fares.
MINIMUM_FARE = {
    "Hatchback": Decimal("84.00"),
    "Sedan": Decimal("93.00"),
    "SUV": Decimal("102.00"),
}
TOUR_GUIDE_FEE = Decimal("150.00")   # flat add-on for TOUR trips

# ---- DRIVER_RENTAL ----
RENTAL_HOURLY_RATE = Decimal("150.00")
RENTAL_MINIMUM_HOURS = Decimal("2.00")
RENTAL_BASE_FEE = Decimal("50.00")   # covers driver reaching the pickup point

# ---- Multipliers ----
NIGHT_SURCHARGE_MULTIPLIER = Decimal("1.15")   # 10pm-6am IST
NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 6

ROAD_CIRCUITY_FACTOR = Decimal("1.20")  # straight-line -> road estimate

PEAK_MULTIPLIER = Decimal("1.10")       # weekday peak
PEAK_MORNING_START = 8
PEAK_MORNING_END = 11                   # 08:00-11:00
PEAK_EVENING_START = 17
PEAK_EVENING_END = 21                   # 17:00-21:00
COMBINED_TIME_MULT_CAP = Decimal("1.30")  # night*peak never exceeds this
OVERALL_MULT_CAP = Decimal("2.00")  # time*surge stacked never exceeds 2x (anti-gouging)

SURGE_MAX = Decimal("2.00")          # never more than 2x
SURGE_STEP = Decimal("0.25")         # +0.25x per unit of demand/supply ratio above 1
SURGE_RADIUS_KM = 5.0                # local demand/supply window around pickup
SURGE_SMOOTHING_ALPHA = Decimal("0.60")  # weight of fresh value vs cached
SURGE_SMOOTHING_TTL_SECONDS = 120.0
_SURGE_CACHE: dict[tuple, tuple[Decimal, float]] = {}

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


def _as_ist(now: datetime | None) -> datetime:
    if now is None:
        return datetime.now(IST)
    if now.tzinfo is None:
        return now.replace(tzinfo=IST)
    return now.astimezone(IST)


def effective_distance_km(distance_haversine_km: float) -> Decimal:
    return _q(Decimal(str(distance_haversine_km)) * ROAD_CIRCUITY_FACTOR)


def estimate_ride_minutes(effective_km: Decimal) -> Decimal:
    # minutes = km / (km/h) * 60, at AVG_SPEED_KMPH urban average
    return _q(effective_km / AVG_SPEED_KMPH * Decimal("60"))


def resolve_vehicle_type(vehicle_type: str | None) -> str:
    if vehicle_type is None:
        return DEFAULT_VEHICLE_TYPE
    if vehicle_type not in VALID_VEHICLE_TYPES:
        raise ValueError(
            f"Unknown vehicle_type '{vehicle_type}'. "
            f"Choose from: {', '.join(sorted(VALID_VEHICLE_TYPES))}"
        )
    return vehicle_type


def is_night(now: datetime | None = None) -> bool:
    hour = _as_ist(now).hour
    return hour >= NIGHT_START_HOUR or hour < NIGHT_END_HOUR


def is_peak(now: datetime | None = None) -> bool:
    local = _as_ist(now)
    if local.weekday() >= 5:  # Sat/Sun off-peak
        return False
    h = local.hour
    return (PEAK_MORNING_START <= h < PEAK_MORNING_END) or (
        PEAK_EVENING_START <= h < PEAK_EVENING_END
    )


def get_time_multipliers(now: datetime | None = None) -> dict:
    night = is_night(now)
    peak = is_peak(now)
    nmult = NIGHT_SURCHARGE_MULTIPLIER if night else Decimal("1.00")
    pmult = PEAK_MULTIPLIER if peak else Decimal("1.00")
    if nmult * pmult > COMBINED_TIME_MULT_CAP:
        pmult = _q(COMBINED_TIME_MULT_CAP / nmult)
    return {"night": night, "peak": peak, "night_mult": nmult, "peak_mult": pmult}


def compute_surge_multiplier(
    db: Session,
    pickup_lat: float | None = None,
    pickup_lng: float | None = None,
    radius_km: float = SURGE_RADIUS_KM,
    now: datetime | None = None,
) -> Decimal:
    """
    Local demand-based surge: distance + age weighted REQUESTED trips vs.
    distance-weighted available drivers within radius_km of the pickup.

    demand   = sum((1 - 0.5*d/r) * (1 + min(age_min/15,1)*0.5))
    supply   = sum(1 - 0.5*d/r)
    ratio    = demand / supply; <=1 -> no surge, else linear capped at SURGE_MAX.
    Zero supply -> graded 1 + 0.25*demand (cap MAX), not an instant max.
    Fresh value is blended with a <2min cached value (alpha 0.6) and
    rounded to 0.05 steps for stability. No coords -> legacy global count.
    """
    if pickup_lat is None or pickup_lng is None:
        pending = (
            db.query(models.Trip)
            .filter(models.Trip.trip_status == "REQUESTED")
            .count()
        )
        available = (
            db.query(models.Driver)
            .filter(models.Driver.availability_status.is_(True))
            .filter(models.Driver.is_active.is_(True))
            .filter(models.Driver.is_verified.is_(True))
            .count()
        )
        if available == 0:
            return _q(min(Decimal("1.00") + Decimal(pending) * SURGE_STEP, SURGE_MAX))
        ratio = Decimal(pending) / Decimal(available)
        if ratio <= 1:
            return Decimal("1.00")
        return _q(min(Decimal("1.00") + (ratio - 1) * SURGE_STEP, SURGE_MAX))

    lat_d = radius_km / 111.0
    cos_lat = max(abs(math.cos(math.radians(pickup_lat))), 0.2)
    lng_d = radius_km / (111.0 * cos_lat)
    pending_trips = (
        db.query(models.Trip)
        .filter(models.Trip.trip_status == "REQUESTED")
        .filter(models.Trip.pickup_lat.between(pickup_lat - lat_d, pickup_lat + lat_d))
        .filter(models.Trip.pickup_lng.between(pickup_lng - lng_d, pickup_lng + lng_d))
        .all()
    )
    drivers = (
        db.query(models.Driver)
        .filter(models.Driver.availability_status.is_(True))
        .filter(models.Driver.is_active.is_(True))
        .filter(models.Driver.is_verified.is_(True))
        .filter(models.Driver.current_lat.isnot(None))
        .filter(models.Driver.current_lng.isnot(None))
        .all()
    )
    ref = _as_ist(now)
    demand = Decimal("0")
    for t in pending_trips:
        if t.pickup_lat is None or t.pickup_lng is None:
            continue
        d = haversine_km(pickup_lat, pickup_lng, float(t.pickup_lat), float(t.pickup_lng))
        if d > radius_km:
            continue
        w_dist = Decimal("1") - Decimal("0.5") * Decimal(str(d / radius_km))
        created = t.created_at
        if created is not None:
            if created.tzinfo is None:
                created = created.replace(tzinfo=IST)
            age_min = max((ref - created).total_seconds() / 60.0, 0.0)
        else:
            age_min = 0.0
        w_age = Decimal("1") + min(Decimal(str(age_min / 15.0)), Decimal("1")) * Decimal("0.5")
        demand += w_dist * w_age
    supply = Decimal("0")
    for dr in drivers:
        d = haversine_km(pickup_lat, pickup_lng, float(dr.current_lat), float(dr.current_lng))
        if d > radius_km:
            continue
        supply += Decimal("1") - Decimal("0.5") * Decimal(str(d / radius_km))

    if supply < Decimal("0.05"):
        raw = min(Decimal("1.00") + demand * SURGE_STEP, SURGE_MAX)
    else:
        ratio = demand / supply
        if ratio <= 1:
            raw = Decimal("1.00")
        else:
            raw = min(Decimal("1.00") + (ratio - 1) * SURGE_STEP, SURGE_MAX)

    key = (round(pickup_lat, 2), round(pickup_lng, 2))
    ts = time.monotonic()
    cached = _SURGE_CACHE.get(key)
    if cached is not None:
        prev, prev_ts = cached
        if ts - prev_ts < SURGE_SMOOTHING_TTL_SECONDS:
            raw = SURGE_SMOOTHING_ALPHA * raw + (Decimal("1") - SURGE_SMOOTHING_ALPHA) * prev
    # Round to 0.05 steps for stability, then to paise
    steps = (raw / Decimal("0.05")).to_integral_value(rounding=ROUND_HALF_UP)
    raw = _q(steps * Decimal("0.05"))
    _SURGE_CACHE[key] = (raw, ts)
    return raw


def vehicle_multiplier(vehicle_type: str | None) -> Decimal:
    # Differentiation now lives in per-type BASE/PER_KM/PER_MINUTE tables;
    # this validates the type and returns 1.00 for breakdown compat.
    resolve_vehicle_type(vehicle_type)
    return Decimal("1.00")


def calculate_ride_fare(
    distance_km: float,
    vehicle_type: str | None,
    surge: Decimal,
    night: bool,
    is_tour: bool = False,
    peak: bool = False,
    duration_minutes: float | None = None,
) -> dict:
    """
    Returns a breakdown dict so the receipt can explain the fare.
    distance_km is haversine km in; road factor + per-minute applied inside.
    """
    vtype = resolve_vehicle_type(vehicle_type)
    raw = Decimal(str(distance_km))
    eff = _q(raw * ROAD_CIRCUITY_FACTOR)
    minutes = (
        Decimal(str(duration_minutes))
        if duration_minutes is not None
        else estimate_ride_minutes(eff)
    )

    # Govt-slab structure: base covers the first INCLUDED_KM (and its time);
    # only extra km/minutes are billed on top.
    chargeable_km = max(eff - INCLUDED_KM, Decimal("0"))
    billable_minutes = max(minutes - INCLUDED_MINUTES, Decimal("0"))
    base = BASE_FARE[vtype] + chargeable_km * PER_KM_RATE[vtype] + billable_minutes * PER_MINUTE_RATE[vtype]
    base = max(base, MINIMUM_FARE[vtype])

    vmult = Decimal("1.00")
    nmult = NIGHT_SURCHARGE_MULTIPLIER if night else Decimal("1.00")
    pmult = PEAK_MULTIPLIER if peak else Decimal("1.00")
    if nmult * pmult > COMBINED_TIME_MULT_CAP:
        pmult = _q(COMBINED_TIME_MULT_CAP / nmult)
    # Anti-gouging: stacked time*surge capped at OVERALL_MULT_CAP
    if nmult * pmult * surge > OVERALL_MULT_CAP:
        surge = _q(OVERALL_MULT_CAP / (nmult * pmult))

    subtotal = base * vmult * nmult * pmult * surge
    tour_fee = TOUR_GUIDE_FEE if is_tour else Decimal("0.00")
    total = _q(subtotal + tour_fee)

    return {
        "base_fare": _q(base),
        "raw_distance_km": _q(raw),
        "effective_distance_km": eff,
        "chargeable_distance_km": _q(chargeable_km),
        "estimated_minutes": _q(minutes),
        "billable_minutes": _q(billable_minutes),
        "vehicle_type": vtype,
        "vehicle_type_multiplier": vmult,
        "night_surcharge": night,
        "night_multiplier": nmult,
        "peak_surcharge": peak,
        "peak_multiplier": pmult,
        "surge_multiplier": surge,
        "tour_guide_fee": tour_fee,
        "fare": total,
    }


RENTAL_SURGE_MAX = Decimal("1.50")  # rentals share scarcity lightly


def calculate_rental_fare(
    duration_hours: float,
    night: bool,
    peak: bool = False,
    surge: Decimal | None = None,
) -> dict:
    hours = max(Decimal(str(duration_hours)), RENTAL_MINIMUM_HOURS)
    nmult = NIGHT_SURCHARGE_MULTIPLIER if night else Decimal("1.00")
    pmult = PEAK_MULTIPLIER if peak else Decimal("1.00")
    if nmult * pmult > COMBINED_TIME_MULT_CAP:
        pmult = _q(COMBINED_TIME_MULT_CAP / nmult)
    smult = min(surge if surge is not None else Decimal("1.00"), RENTAL_SURGE_MAX)
    total = _q((RENTAL_BASE_FEE + hours * RENTAL_HOURLY_RATE) * nmult * pmult * smult)
    return {
        "base_fare": _q(RENTAL_BASE_FEE + hours * RENTAL_HOURLY_RATE),
        "billed_hours": hours,
        "vehicle_type_multiplier": Decimal("1.00"),
        "night_surcharge": night,
        "night_multiplier": nmult,
        "peak_surcharge": peak,
        "peak_multiplier": pmult,
        "surge_multiplier": smult,
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