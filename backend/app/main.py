from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.routers import (
    auth, trips, drivers, payments, feedback,
    emergency, rewards, vehicles, attractions, admin,
)

app = FastAPI(
    title="Smart Cab Booking System API",
    description="B.Tech project -- IIIT Kottayam. Ride booking, driver rental, tour guide, "
                "emergency alerts, rewards, and admin monitoring.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(trips.router, prefix="/trips", tags=["trips"])
app.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
app.include_router(emergency.router, prefix="/emergency", tags=["emergency"])
app.include_router(rewards.router, prefix="/rewards", tags=["rewards"])
app.include_router(vehicles.router, prefix="/vehicles", tags=["user-vehicles"])
app.include_router(attractions.router, prefix="/attractions", tags=["attractions"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/")
def root():
    return {"message": "Smart Cab Booking System API is running", "docs": "/docs"}


@app.get("/health/db")
def db_health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}


@app.get("/users/me", response_model=schemas.UserOut)
def get_my_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user