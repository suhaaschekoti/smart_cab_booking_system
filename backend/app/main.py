from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.routers import auth, trips, drivers

app = FastAPI(title="Smart Cab Booking System API")

# Allow the React dev server to call this API. Tighten this list
# once you have a real deployed frontend URL.
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


@app.get("/")
def root():
    return {"message": "Smart Cab Booking System API is running"}


@app.get("/health/db")
def db_health_check(db: Session = Depends(get_db)):
    """Quick check that the API can actually reach Postgres."""
    db.execute(text("SELECT 1"))
    return {"database": "connected"}


@app.get("/attractions", response_model=list[schemas.AttractionOut])
def list_attractions(db: Session = Depends(get_db)):
    """Example public ORM route -- tour guide feature, list all attractions."""
    return db.query(models.Attraction).order_by(models.Attraction.name).all()


@app.get("/users/me", response_model=schemas.UserOut)
def get_my_profile(current_user: models.User = Depends(auth.get_current_user)):
    """
    Example PROTECTED route -- requires a valid user JWT (from /auth/user/login).
    Use this same Depends(auth.get_current_user) pattern on any route that
    should only work for a logged-in passenger. Equivalent dependencies
    exist for drivers (auth.get_current_driver) and admins (auth.get_current_admin).
    """
    return current_user


# More routers get included here as they're built, e.g.:
# from app.routers import payments
# app.include_router(payments.router, prefix="/payments", tags=["payments"])