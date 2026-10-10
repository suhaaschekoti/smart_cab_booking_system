# Backend: Smart Cab Booking System API

FastAPI service using SQLAlchemy 2 ORM on PostgreSQL (`psycopg2` driver). For the project overview, features and pricing model, see the [root README](../README.md); this file covers working on the backend itself.

## Structure
```
backend/
├── app/
│   ├── main.py             # app setup, CORS, security headers, router registration, health checks
│   ├── config.py           # env-based settings (pydantic-settings)
│   ├── database.py         # SQLAlchemy engine/session + get_db dependency
│   ├── models.py           # ORM models, one class per table (kept in sync with migrations by hand)
│   ├── schemas.py          # Pydantic request/response schemas (separate from ORM models)
│   ├── auth.py             # password hashing, access tokens, short-lived action tokens
│   ├── pricing.py          # Haversine distance, fare, surge, night/peak and reward logic
│   ├── ai_planner.py       # Groq-powered tour itinerary generation
│   ├── overpass_utils.py   # live "near me" attraction search via OSM Nominatim (cached 1 h)
│   ├── email_utils.py      # Gmail SMTP: verification, password reset and SOS emails
│   ├── ratelimit.py        # in-memory per-IP rate limiter for auth endpoints
│   └── routers/
│       ├── auth.py         # register/login/verify/reset for all 3 roles, profile, auth dependencies
│       ├── trips.py        # estimate, RIDE/TOUR/DRIVER_RENTAL booking, matching, lifecycle
│       ├── drivers.py      # driver profile, stats, vehicle, availability toggle
│       ├── vehicles.py     # passenger's own vehicles (for driver rental)
│       ├── payments.py     # mock payments, reward redemption, receipts
│       ├── feedback.py     # ratings and driver average rating
│       ├── emergency.py    # emergency contacts and SOS email alerts
│       ├── rewards.py      # reward balance and history
│       ├── attractions.py  # catalogue, nearby search, AI tour planner
│       └── admin.py        # stats, user/driver management, alerts, attractions
├── migrations/             # numbered SQL files, source of truth for the schema
├── scripts/
│   └── seed_db.py          # demo data (raw psycopg2, standalone script)
├── .env.example
├── Dockerfile              # python:3.12-slim
├── Makefile                # Unix/Mac only, see Windows notes below
├── requirements.txt
└── start.sh
```

## Configuration
Copy `.env.example` to `.env` and edit it. The variables are documented in the [root README](../README.md#configuration). The ones you must act on:

- **`JWT_SECRET_KEY`** must be at least 32 characters and not the example value, or the app refuses to start. Generate one with `openssl rand -hex 32`.
- **`DATABASE_URL`** is the host-side value, used when running Python directly on your machine (`python scripts/seed_db.py`, `uvicorn` outside Docker). Docker's Postgres is mapped to host port **5441**:
  ```
  DATABASE_URL=postgresql://postgres:postgres@localhost:5441/smart_cab_db
  ```
  The backend container uses a different internal address (`db:5432`) set in `docker-compose.yml`; you don't need to touch that.
- **`GROQ_API_KEY`** is optional. Without it the AI tour planner returns a short offline response.

## Setup (Docker, recommended day to day)
From the project root, after creating `backend/.env`:
```bash
docker compose up -d --build
```
Your local `backend/app/` is mounted into the container and Uvicorn runs with `--reload`, so code edits take effect immediately. Only `requirements.txt` or `Dockerfile` changes need `--build`. Check http://localhost:8000/health/db and the interactive docs at http://localhost:8000/docs.

## Setup (local, without Docker for the backend)
Keep Postgres in Docker either way:
```bash
docker compose up -d db
```
Then, from `backend/`:
```bash
python3.12 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # set JWT_SECRET_KEY
uvicorn app.main:app --reload
```

Use Python 3.12 (what the Dockerfile uses). The pinned `psycopg2-binary==2.9.9` has no wheel for Python 3.13+ and fails to build.

**On Windows, `make` isn't available by default.** Run the underlying commands instead of `make install` / `make run` / `make seed`:
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
python scripts/seed_db.py
```

Makefile targets (macOS/Linux): `install`, `run`, `seed`, `migrate FILE=migrations/000X_name.sql`, `docker-up`, `docker-down`.

## Known gotcha: bcrypt version
`requirements.txt` pins `bcrypt==4.0.1` deliberately. Newer releases (4.1+) break compatibility with `passlib` 1.7.4 (a missing `__about__` attribute makes password hashing fail with a confusing "password cannot be longer than 72 bytes" error). Don't upgrade bcrypt without also upgrading passlib and retesting.

## Seeding test data
```bash
python scripts/seed_db.py                          # from backend/, with .env pointing at localhost:5441
docker compose exec backend python scripts/seed_db.py   # or inside the running container
```
It is safe to re-run (existing rows are skipped). It creates:
- 2 passengers (`suhaas@example.com`, `mounish@example.com`)
- 3 drivers (`chanakya@`, `ramesh@`, `priya@example.com`) with a Sedan, Hatchback and SUV, all online around Kottayam
- 1 admin (`admin`)
- 12 tourist attractions

All passengers and drivers use password `password123`; the admin uses `admin123`. Seeded accounts are pre-verified, so they work without Gmail configured. The seed script is also how you get the first admin, since only an existing admin can create another.

## Email setup
Gmail SMTP is used for sign-up verification, password reset and SOS alerts. To enable it:
1. Use a Gmail account with 2-Step Verification enabled.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. Set `GMAIL_ADDRESS` to the address and `GMAIL_APP_PASSWORD` to the 16-character password (not your normal Gmail password).

Without it, registering a passenger or driver returns a 500 and leaves an unverified account behind, and SOS notifications are recorded as failed.

## Auth
Three roles, each with its own endpoints and JWT:

| Role | Endpoints |
|---|---|
| Passenger | `POST /auth/user/register`, `/login`, `/forgot-password`, `/reset-password`; `GET /auth/user/verify-email` |
| Driver | `POST /auth/driver/register`, `/login`, `/forgot-password`, `/reset-password`; `GET /auth/driver/verify-email` |
| Admin | `POST /auth/admin/login`; `POST /auth/admin/register` (requires an existing admin's token) |

Each login returns an `access_token` embedding the role, so a passenger token can't call driver or admin routes. Passengers and drivers must verify their email before logging in. Verification links last 60 minutes and reset links 30 minutes (hardcoded in `routers/auth.py`; the `*_EXPIRE_MINUTES` settings currently only change the wording in the email). Reset links stop working once the password changes.

Profile and password changes: `GET/PATCH /auth/user/me`, `PATCH /auth/driver/me`, `POST /auth/{user,driver}/me/password`.

Protect a new route with the matching dependency:
```python
from app.routers import auth

@router.get("/my-things")
def my_things(current_user: models.User = Depends(auth.get_current_user)):
    ...
```
Equivalents: `auth.get_current_driver`, `auth.get_current_admin`.

To try it in `/docs`, click **Authorize** and paste a token (no `Bearer` prefix) from the matching `/auth/{role}/login` call. Login endpoints are rate limited per IP.

## Trips
All booking endpoints need a passenger JWT.

- `POST /trips/estimate`: fare quote for any service type, no trip created.
- `POST /trips`: book a **RIDE** (pickup/drop coordinates, optional `preferred_vehicle_type`).
- `POST /trips/tour`: book a **TOUR** to a catalogue attraction (`attraction_id` is required); adds the guide fee.
- `POST /trips/rental`: book a **DRIVER_RENTAL** using one of the passenger's saved vehicles (`user_vehicle_id`, `duration_hours`).
- `GET /trips/my`, `GET /trips/{id}`: history and detail.
- `PATCH /trips/{id}/cancel`: passenger cancels (only while `REQUESTED` or `ACCEPTED`). Three or more cancellations in the last ten trips flags the account.

Driver actions need a driver JWT: `GET /trips/driver/assigned`, then `PATCH /trips/{id}/accept` (`REQUESTED` → `ACCEPTED`), `/reject` (re-matches to another driver), `/start` (`ACCEPTED` → `ONGOING`) and `/complete` (`ONGOING` → `COMPLETED`, which also puts the driver back to available).

The estimate and booking share one pricing path in `app/pricing.py`: tweak the constants there, not inline in the router. Booking re-prices if the matched driver's vehicle type differs from the one requested. For a driver to be matched they need `availability_status = TRUE`, `is_active`, `is_verified`, a `current_lat`/`current_lng`, and (for rides and tours) a row in `vehicles`.

## Other routers
- **Drivers:** `GET /drivers/me`, `/drivers/me/stats`, `/drivers/me/vehicle`; `PATCH /drivers/me/availability` (optionally updates `current_lat`/`current_lng` in the same call; the frontend sends browser geolocation when going online, since a driver with no location is never matched).
- **Vehicles:** `GET/POST /vehicles`, `DELETE /vehicles/{id}` (a vehicle used by an active rental can't be deleted).
- **Payments:** `POST /payments/{trip_id}` (mock; modes `WALLET`, `CARD`, `UPI`, `CASH`; completed trips only; optional `points_to_redeem`), `GET /payments/{trip_id}/receipt`. Paying awards 10 reward points and adds ₹5 to the driver's incentive score.
- **Feedback:** `POST/GET /feedback/{trip_id}` (paid, completed trips only; one per trip). Recalculates the driver's average rating.
- **Rewards:** `GET /rewards/me`.
- **Emergency:** `GET/POST /emergency/contacts` (max 5), `DELETE /emergency/contacts/{id}`, `POST /emergency/sos` (active trips only, emails every saved contact that has an email), `GET /emergency/alerts/my`.
- **Attractions (public):** `GET /attractions` (filters: `city`, `category`, `near_lat`/`near_lng`/`radius_km`), `/attractions/categories`, `/attractions/nearby` (live OSM search with a fallback to the seeded catalogue), `POST /attractions/plan` (AI itinerary).
- **Admin:** `GET /admin/{stats,users,drivers,trips,payments,alerts}`, `PATCH /admin/alerts/{id}/acknowledge`, `/admin/users/{id}/{active,flag}`, `/admin/drivers/{id}/{active,verify}`, `POST/DELETE /admin/attractions`.

The full, always-current list is at `/docs`.

## Adding a new route
Add a router file under `app/routers/`, then include it in `app/main.py`:
```python
from app.routers import notifications
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
```
Query via the ORM (`db: Session = Depends(get_db)`):
```python
db.query(models.Trip).filter(models.Trip.user_id == user_id).all()
```
Always set `response_model=` on routes returning ORM objects (a matching `schemas.py` class with `from_attributes = True`); FastAPI can't serialize raw SQLAlchemy instances.

## Changing the schema
Two things must stay in sync:
1. Add a new numbered file to `migrations/` (see [`migrations/README.md`](./migrations/README.md)). This is what actually runs against Postgres.
2. Update the matching class in `app/models.py`.

`models.py` is not auto-generated from the SQL files. Keep them in sync by hand, or consider adding Alembic if this becomes error-prone. Docker only runs migrations the first time the database volume is created, so apply new ones to a running database manually (see the migrations README).

## Behaviour to be aware of
- Rate limiting, surge smoothing and the nearby-attractions cache are in-memory and per process; they reset on restart and won't be shared across multiple workers.
- CORS only allows `http://localhost:5173` and `http://127.0.0.1:5173`; edit `allow_origins` in `main.py` before deploying elsewhere.
- Distances are Haversine × 1.2, not real routing. Payments are mock.
- There is no automated test suite yet.