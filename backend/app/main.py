from fastapi import FastAPI, Depends

from app.database import get_db

app = FastAPI(title="Smart Cab Booking System API")


@app.get("/")
def root():
    return {"message": "Smart Cab Booking System API is running"}


@app.get("/health/db")
def db_health_check(db=Depends(get_db)):
    """Quick check that the API can actually reach Postgres."""
    db.execute("SELECT 1 AS ok")
    return db.fetchone()


@app.get("/attractions")
def list_attractions(db=Depends(get_db)):
    """Example raw-SQL route -- tour guide feature, list all attractions."""
    db.execute("SELECT * FROM attractions ORDER BY name")
    return db.fetchall()


# Routers for each module get included here as they're built, e.g.:
# from app.routers import users, drivers, trips
# app.include_router(users.router, prefix="/users", tags=["users"])
# app.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
# app.include_router(trips.router, prefix="/trips", tags=["trips"])
