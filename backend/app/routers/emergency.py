import html

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.email_utils import send_email
from app.routers.auth import get_current_user

router = APIRouter()


# ------------------------------------------------------------
# Emergency contacts
# ------------------------------------------------------------

@router.get("/contacts", response_model=list[schemas.EmergencyContactOut])
def list_contacts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.EmergencyContact).filter(models.EmergencyContact.user_id == current_user.user_id).all()


@router.post("/contacts", response_model=schemas.EmergencyContactOut, status_code=status.HTTP_201_CREATED)
def add_contact(payload: schemas.EmergencyContactIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    count = db.query(models.EmergencyContact).filter(models.EmergencyContact.user_id == current_user.user_id).count()
    if count >= 5:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can save at most 5 emergency contacts")
    c = models.EmergencyContact(user_id=current_user.user_id, **payload.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return c


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    c = db.query(models.EmergencyContact).filter(
        models.EmergencyContact.contact_id == contact_id,
        models.EmergencyContact.user_id == current_user.user_id,
    ).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    db.delete(c); db.commit()


# ------------------------------------------------------------
# SOS
# ------------------------------------------------------------

def _sos_email_html(user: models.User, trip: models.Trip, lat, lng) -> str:
    e = html.escape
    uname, uphone = e(user.name), e(user.phone)
    pickup, drop = e(trip.pickup_location), e(trip.drop_location)
    maps_link = f"https://www.google.com/maps?q={lat},{lng}" if lat is not None and lng is not None else None
    driver_line = ""
    if trip.driver:
        veh = trip.driver.vehicles[0] if trip.driver.vehicles else None
        driver_line = f"""
        <p><strong>Driver:</strong> {e(trip.driver.name)}, {e(trip.driver.phone)}<br>
        <strong>Vehicle:</strong> {e(veh.vehicle_number) if veh else "—"} ({e(veh.vehicle_type or "") if veh else "—"})</p>"""
    loc = f'<p><a href="{maps_link}" style="background:#e6636b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Open live location in Google Maps</a></p>' if maps_link else "<p><em>Location unavailable at the time of alert.</em></p>"
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#e6636b;">Emergency alert from {uname}</h2>
      <p>{uname} ({uphone}) has triggered an emergency alert during a Smart Cab Booking trip.</p>
      <p><strong>Trip #{trip.trip_id}</strong><br>
      From: {pickup}<br>
      To: {drop}</p>
      {driver_line}
      {loc}
      <p style="color:#8891a7;font-size:13px;">Please try to contact {uname} immediately. If you cannot reach them, consider contacting local emergency services.</p>
    </div>"""


@router.post("/sos", response_model=schemas.SafetyAlertOut, status_code=status.HTTP_201_CREATED)
def trigger_sos(payload: schemas.SOSIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    trip = (
        db.query(models.Trip).options(joinedload(models.Trip.driver).joinedload(models.Driver.vehicles))
        .filter(models.Trip.trip_id == payload.trip_id).first()
    )
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if trip.user_id != current_user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This is not your trip")
    if trip.trip_status not in ("ACCEPTED", "ONGOING"):
        raise HTTPException(status.HTTP_409_CONFLICT, "SOS can only be triggered during an active trip")

    contacts = db.query(models.EmergencyContact).filter(models.EmergencyContact.user_id == current_user.user_id).all()
    if not contacts:
        raise HTTPException(status.HTTP_409_CONFLICT, "No emergency contacts saved -- add at least one before triggering SOS")

    alert = models.SafetyAlert(
        trip_id=trip.trip_id, user_id=current_user.user_id,
        alert_type="EmergencyContactShare",
        alert_lat=payload.current_lat, alert_lng=payload.current_lng,
        alert_status="SENT",
    )
    db.add(alert); db.flush()

    html_body = _sos_email_html(current_user, trip, payload.current_lat, payload.current_lng)
    for c in contacts:
        status_str = "SKIPPED"
        if c.contact_email:
            try:
                send_email(c.contact_email, f"Emergency alert from {current_user.name}", html_body)
                status_str = "SENT"
            except Exception:
                status_str = "FAILED"
        db.add(models.AlertNotification(alert_id=alert.alert_id, contact_id=c.contact_id, notified_via="EMAIL", delivery_status=status_str))

    current_user.safety_mode_enabled = True
    db.commit(); db.refresh(alert)
    return alert


@router.get("/alerts/my", response_model=list[schemas.SafetyAlertOut])
def my_alerts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return (
        db.query(models.SafetyAlert).options(joinedload(models.SafetyAlert.notifications))
        .filter(models.SafetyAlert.user_id == current_user.user_id)
        .order_by(models.SafetyAlert.alert_time.desc()).all()
    )