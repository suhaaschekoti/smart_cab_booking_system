from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

app = FastAPI(title="Smart Cab Booking System API")


@app.get("/")
def root():
    return {"message": "Smart Cab Booking System API is running"}


@app.get("/health/db")
def db_health_check(db: Session = Depends(get_db)):
    """Quick check that the API can actually reach Postgres."""
    db.execute(text("SELECT 1"))
    return {"database": "connected"}


# Routers for each module get included here as they're built, e.g.:
# from app.routers import users, drivers, trips
# app.include_router(users.router, prefix="/users", tags=["users"])
# app.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
# app.include_router(trips.router, prefix="/trips", tags=["trips"])
