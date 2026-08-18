# Smart Cab Booking System

A B.Tech group project (3-person team) implementing a Smart Cab Booking System
with Passenger, Driver, and Admin roles.

## Tech Stack
- **Backend**: FastAPI (Python) — SQLAlchemy ORM, Postgres
- **Frontend**: React + Vite (JavaScript)
- **Database**: PostgreSQL (local via Docker for now, Supabase later) — host port `5441`
- **Auth**: JWT, role embedded in the token, separate login per role
- **Realtime**: Socket.io (for simulated live driver location) — not yet implemented

## Project Structure
```
smart_cab_booking_system/
├── backend/                       # FastAPI app — see backend/README.md
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   └── routers/
│   │       └── auth.py
│   ├── migrations/                 # numbered SQL files, source of truth for schema
│   ├── scripts/
│   │   └── seed_db.py
│   ├── .env.example
│   ├── Dockerfile
│   ├── Makefile
│   ├── README.md
│   ├── requirements.txt
│   └── start.sh
├── frontend/                      # React app — see frontend/README.md
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js
│   │   │   └── auth.js
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── .env.example
├── docker-compose.yml              # orchestrates Postgres + backend, live-reload mounted
├── .gitattributes
└── .gitignore
```

## Quick Start

**Everything backend-related** (Postgres + API, live-reload on code changes):
```bash
docker compose up -d
```
First run only needs `--build`; after that, plain `docker compose up -d`
picks up your code edits automatically (see `backend/README.md` for how
this works). Check `http://localhost:8000/health/db`.

**Frontend** (see [`frontend/README.md`](./frontend/README.md) for full detail):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Opens at `http://localhost:5173`.

**Try it end-to-end**:
1. Seed test accounts: `cd backend && python scripts/seed_db.py`
   (all seeded accounts use password `password123`)
2. Open `http://localhost:5173/login`, log in as Passenger with
   `suhaas@example.com` / `password123`
3. Or try `/register` to create a fresh account for any of the 3 roles

## Switching to Supabase (later)
1. Create the Supabase project and run each file in `backend/migrations/`,
   in order, in its SQL Editor.
2. Copy the Supabase connection string from **Project Settings → Database**.
3. Update `DATABASE_URL` in `backend/.env` — no code changes needed.

## Team Module Ownership
- **Passenger module** (auth, booking, trip view) — Member A
- **Driver module** (dashboard, accept/reject, live location) — Member B
- **Admin module** (user/driver management, payments, ratings, alerts) — Member C

## Progress So Far
- [x] Database schema (13 tables, incl. driver-rental + tour guide additions)
- [x] Local Postgres via Docker, with live-reloading backend
- [x] Auth: register + login for all 3 roles (User/Driver/Admin), JWT-based
- [x] Frontend: Login + Register pages, role-tabbed, wired to the real API
- [ ] Booking flow (trip request, driver matching, trip lifecycle) — next up
- [ ] Payments, feedback, emergency alerts, rewards
- [ ] Driver + Admin dashboards

## Scope Notes
- Driver-to-passenger matching uses straight-line (Haversine) distance, not real routing/traffic-aware ETA.
- Live tracking is simulated (driver location updated periodically), not real GPS hardware integration.
- Fraud detection is a simple rule-based flag (`users.is_flagged`), not ML-based.
- Payments run in test/mock mode — no real money is processed.
- `trips.service_type` covers three offerings: `RIDE` (standard cab), `DRIVER_RENTAL`
  (a driver comes to drive the passenger's own vehicle — e.g. drunk pickup, errands),
  and `TOUR` (ride to a suggested attraction). See `backend/migrations/0001_initial_schema.sql`
  for the exact constraint logic on which vehicle field applies to each type.
- Auth uses JWTs with the role embedded, issued via separate login endpoints
  per role (`/auth/user/login`, `/auth/driver/login`, `/auth/admin/login`).