# Backend — Smart Cab Booking System API

FastAPI service using SQLAlchemy ORM (Postgres via `psycopg2` driver).

## Structure
```
backend/
├── app/
│   ├── main.py         # entrypoint + routes
│   ├── config.py       # env-based settings
│   ├── database.py     # SQLAlchemy engine/session + get_db dependency
│   ├── models.py        # ORM models -- one class per table, matches migrations/0001_initial_schema.sql
│   ├── schemas.py       # Pydantic schemas for request/response validation (separate from ORM models)
│   └── routers/         # per-module route files go here as they're built
├── migrations/          # numbered SQL files, source of truth for the actual schema
├── scripts/
│   └── seed_db.py       # populates test data for local dev/demo (raw psycopg2, standalone script)
├── .env.example
├── Dockerfile
├── Makefile
├── requirements.txt
└── start.sh
```

## Setup (local dev, without Docker)
```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # fill in JWT_SECRET_KEY etc.
uvicorn app.main:app --reload
```
Or with the Makefile:
```bash
make install
make run
```

## Setup (Docker)
From the project root:
```bash
docker compose up -d --build
```
This starts both Postgres and the backend API together.

## Seeding test data
```bash
make seed
```

## Auth
Three separate roles, each with its own register/login endpoints and JWT:
- `POST /auth/user/register`, `POST /auth/user/login`
- `POST /auth/driver/register`, `POST /auth/driver/login`
- `POST /auth/admin/register`, `POST /auth/admin/login`

Each login returns a JWT (`access_token`) embedding the role, so a user's
token can't be used to call driver/admin-only routes. To protect a new
route, add the matching dependency:
```python
from app.routers import auth

@router.get("/my-trips")
def my_trips(current_user: models.User = Depends(auth.get_current_user)):
    ...
```
Equivalent dependencies: `auth.get_current_driver`, `auth.get_current_admin`.

Test it via `/docs` — use the "Authorize" button after logging in through
the matching login route, or call `/auth/user/login` directly and pass
the returned token as a `Bearer` header on subsequent requests.

Seeded accounts (after `make seed`) all use password `password123`.

## Adding a new route
Add a router file under `app/routers/`, then include it in `app/main.py`:
```python
from app.routers import trips
app.include_router(trips.router, prefix="/trips", tags=["trips"])
```
Query via the ORM (`db: Session = Depends(get_db)`), e.g.:
```python
db.query(models.Trip).filter(models.Trip.user_id == user_id).all()
```
Always set `response_model=` on routes returning ORM objects (a matching
`schemas.py` class with `from_attributes = True`) — FastAPI can't
serialize raw SQLAlchemy model instances directly.

## Changing the schema
Two things need to stay in sync when you change the schema:
1. Add a new numbered file to `migrations/` (see `migrations/README.md`)
   — this is what actually runs against Postgres.
2. Update the matching class in `app/models.py` to reflect the change.

`models.py` is not auto-generated from the SQL files — keep them in sync
by hand, or consider adding Alembic later if this becomes error-prone.
