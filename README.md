# Smart Cab Booking System

A B.Tech group project (3-person team) implementing a Smart Cab Booking System
with Passenger, Driver, and Admin roles.

## Tech Stack
- **Backend**: FastAPI (Python) — raw SQL via `psycopg2`, no ORM
- **Frontend**: React
- **Database**: PostgreSQL (local via Docker for now, Supabase later)
- **Realtime**: Socket.io (for simulated live driver location)

## Project Structure
```
smart_cab_booking_system/
├── backend/                       # FastAPI app — see backend/README.md
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   └── routers/
│   ├── migrations/                 # numbered SQL files, source of truth for schema
│   ├── scripts/
│   │   └── seed_db.py
│   ├── .env.example
│   ├── Dockerfile
│   ├── Makefile
│   ├── README.md
│   ├── requirements.txt
│   └── start.sh
├── frontend/                      # React app (to be added)
├── docker-compose.yml              # orchestrates Postgres + backend together
├── .gitattributes
└── .gitignore
```

## Quick Start
See [`backend/README.md`](./backend/README.md) for full backend setup
(local venv or Docker). Short version, from the project root:
```bash
docker compose up -d --build
```
Then check `http://localhost:8000/health/db`.

## Switching to Supabase (later)
1. Create the Supabase project and run each file in `backend/migrations/`,
   in order, in its SQL Editor.
2. Copy the Supabase connection string from **Project Settings → Database**.
3. Update `DATABASE_URL` in `backend/.env` — no code changes needed.

## Team Module Ownership
- **Passenger module** (auth, booking, trip view) — Member A
- **Driver module** (dashboard, accept/reject, live location) — Member B
- **Admin module** (user/driver management, payments, ratings, alerts) — Member C

## Scope Notes
- Driver-to-passenger matching uses straight-line (Haversine) distance, not real routing/traffic-aware ETA.
- Live tracking is simulated (driver location updated periodically), not real GPS hardware integration.
- Fraud detection is a simple rule-based flag (`users.is_flagged`), not ML-based.
- Payments run in test/mock mode — no real money is processed.
- `trips.service_type` covers three offerings: `RIDE` (standard cab), `DRIVER_RENTAL`
  (a driver comes to drive the passenger's own vehicle — e.g. drunk pickup, errands),
  and `TOUR` (ride to a suggested attraction). See `backend/migrations/0001_initial_schema.sql`
  for the exact constraint logic on which vehicle field applies to each type.
