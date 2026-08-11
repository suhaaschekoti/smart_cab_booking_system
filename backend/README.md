# Backend — Smart Cab Booking System API

FastAPI service, raw SQL via `psycopg2` (no ORM).

## Structure
```
backend/
├── app/
│   ├── main.py         # entrypoint + routes
│   ├── config.py       # env-based settings
│   ├── database.py     # psycopg2 connection pool + get_db dependency
│   └── routers/         # per-module route files go here as they're built
├── migrations/          # numbered SQL migrations, source of truth for schema
├── scripts/
│   └── seed_db.py       # populates test data for local dev/demo
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

## Adding a new route
Add a router file under `app/routers/`, then include it in `app/main.py`:
```python
from app.routers import trips
app.include_router(trips.router, prefix="/trips", tags=["trips"])
```
Keep queries parameterized (`%s` placeholders) — never string-format raw SQL.

## Changing the schema
Add a new numbered file to `migrations/` (see `migrations/README.md`)
rather than editing `0001_initial_schema.sql` directly, once it's been
applied anywhere.
