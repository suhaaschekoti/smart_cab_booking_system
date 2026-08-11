# Smart Cab Booking System

A B.Tech group project (3-person team) implementing a Smart Cab Booking System
with Passenger, Driver, and Admin roles.

## Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React
- **Database**: PostgreSQL (local via Docker for now, Supabase later)
- **Realtime**: Socket.io (for simulated live driver location)

## Project Structure
```
smart_cab_booking_system/
├── backend/            # FastAPI app
│   ├── app/
│   │   ├── main.py         # entrypoint
│   │   ├── config.py        # env-based settings
│   │   ├── database.py      # SQLAlchemy engine/session
│   │   └── models.py        # ORM models matching db/schema.sql
│   ├── requirements.txt
│   └── .env.example
├── frontend/           # React app (to be added)
├── db/
│   └── smart_cab_db_schema.sql   # source of truth for the schema
├── docker-compose.yml  # local Postgres
└── .gitignore
```

## Local Setup (Postgres via Docker)

We're running Postgres locally for now and will migrate to Supabase once
the core booking + trip flow works end-to-end. Since Supabase is just
managed Postgres, the schema and backend code don't need to change —
only the `DATABASE_URL` in `.env`.

### 1. Start local Postgres
```bash
docker compose up -d
```
This spins up Postgres on `localhost:5432` and automatically runs
`db/smart_cab_db_schema.sql` on first startup to create all tables.

> If you change the schema later, either drop the Docker volume and
> restart (`docker compose down -v && docker compose up -d`) to
> re-init from scratch, or re-run the updated SQL manually against
> the running container.

### 2. Backend setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then fill in JWT_SECRET_KEY etc.
uvicorn app.main:app --reload
```
Visit `http://localhost:8000` — you should see the API running.
Visit `http://localhost:8000/health/db` — confirms the API can reach Postgres.
Visit `http://localhost:8000/docs` — interactive FastAPI Swagger UI.

### 3. Frontend setup
_(to be added once the frontend is scaffolded)_

## Switching to Supabase (later)
1. Create the Supabase project and run `db/smart_cab_db_schema.sql` in its SQL Editor.
2. Copy the Supabase connection string from **Project Settings → Database**.
3. Update `DATABASE_URL` in `.env` to the Supabase URI — no code changes needed.

## Team Module Ownership
- **Passenger module** (auth, booking, trip view) — Member A
- **Driver module** (dashboard, accept/reject, live location) — Member B
- **Admin module** (user/driver management, payments, ratings, alerts) — Member C

## Scope Notes
- Driver-to-passenger matching uses straight-line (Haversine) distance, not real routing/traffic-aware ETA.
- Live tracking is simulated (driver location updated periodically), not real GPS hardware integration.
- Fraud detection is a simple rule-based flag (`users.is_flagged`), not ML-based.
- Payments run in test/mock mode — no real money is processed.
