from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Same code works whether DATABASE_URL points to local Postgres or
# a Supabase Postgres instance -- only the .env value changes.
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency -- yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
