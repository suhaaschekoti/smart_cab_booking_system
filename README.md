# Smart Cab Booking System

A full-stack cab booking platform which supports three roles (passenger, driver, admin) and three kinds of trip: a standard **ride**, **driver rental** (a driver comes to drive your own car), and a **tour** to a nearby attraction with an optional AI trip planner.

## Features

**Passengers**
- Book a ride by picking pickup and drop points on an OpenStreetMap map (search or click), with a live fare estimate before booking
- Automatic matching to the nearest available driver, with an optional vehicle-type preference (Hatchback, Sedan, SUV)
- **Rent a driver**: save your own vehicle, then book an hourly driver for it (2-hour minimum)
- **Tour guide**: browse a curated attraction catalogue, find attractions near you, or ask the AI planner (Groq, Llama models) for an itinerary, then book a ride to a catalogue attraction
- Pay for completed trips (mock payment: UPI, Card, Wallet, Cash), rate the driver, and view receipts
- **Rewards**: earn 10 points per paid trip and redeem them at checkout (1 point = ₹1, up to 50% of the fare)
- **Safety**: save up to 5 emergency contacts; the SOS button emails them your live location, route and driver details during an active trip
- Email verification, password reset, profile editing, light and dark theme

**Drivers**
- Online/offline toggle that shares browser location so nearby riders can be matched
- Accept or decline requests, then run the trip through Start and Complete
- Dashboard with completed trips, earnings, rating and incentive score (+₹5 per paid trip)

**Admins**
- Dashboard with revenue, trip counts, drivers online, average rating and open SOS alerts
- Manage users and drivers: suspend or reactivate, flag users, verify drivers
- Review all trips and payments, acknowledge SOS alerts, and manage the attraction catalogue

**Platform**
- Pricing engine with per-vehicle rates, night and peak multipliers, and local demand-based surge (details below)
- JWT auth with the role embedded in the token and a separate login per role
- Rate limiting on auth endpoints, security headers, and email-verified accounts

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2, Uvicorn (Python 3.12) |
| Database | PostgreSQL 16 (Docker locally, Supabase-compatible) |
| Frontend | React 18, Vite 5, React Router 6, Axios, Motion |
| Maps | Leaflet / react-leaflet, OpenStreetMap tiles, Nominatim geocoding |
| AI planner | Groq API (Llama 3.3 70B by default) via the `groq` SDK |
| Email | Gmail SMTP (verification, password reset, SOS alerts) |
| Auth | JWT (`python-jose`), bcrypt via `passlib` |
| Infra | Docker Compose (Postgres + live-reloading backend) |

## Project Structure

```
smart_cab_booking_system/
├── backend/
│   ├── app/
│   │   ├── main.py             # app setup, CORS, security headers, router registration
│   │   ├── config.py           # env-based settings
│   │   ├── database.py         # SQLAlchemy engine and session
│   │   ├── models.py           # ORM models, one per table
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── auth.py             # password hashing, access and action tokens
│   │   ├── pricing.py          # fare, surge, night/peak and reward logic
│   │   ├── ai_planner.py       # Groq-powered tour itinerary generation
│   │   ├── overpass_utils.py   # live "near me" attraction search (OSM Nominatim)
│   │   ├── email_utils.py      # Gmail SMTP: verification, reset and SOS emails
│   │   ├── ratelimit.py        # in-memory per-IP rate limiter
│   │   └── routers/            # auth, trips, drivers, vehicles, payments, feedback,
│   │                           # emergency, rewards, attractions, admin
│   ├── migrations/             # numbered SQL files (0001-0005), source of truth for the schema
│   ├── scripts/seed_db.py      # demo users, drivers, admin and attractions
│   ├── .env.example
│   ├── Dockerfile
│   ├── Makefile
│   ├── requirements.txt
│   └── start.sh
├── frontend/
│   ├── src/
│   │   ├── api/                # axios client plus one module per backend router
│   │   ├── components/         # MapPicker, PaymentModal, FeedbackModal, SOSButton,
│   │   │                       # EmergencyContacts, TourChatbot, Navbar, ProfileModal, ...
│   │   ├── pages/              # Login, Register, PassengerDashboard, TourGuide, Rewards,
│   │   │                       # Safety, DriverDashboard, AdminDashboard, ...
│   │   ├── theme/              # light/dark theme context
│   │   ├── App.jsx             # routes
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── db/smart_cab_db_schema.sql  # early schema snapshot, superseded by backend/migrations
└── docker-compose.yml          # Postgres + backend
```

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and npm
- Python 3.12 only if you want to run the backend outside Docker. Use 3.12 specifically: the pinned `psycopg2-binary==2.9.9` does not build on Python 3.13+.

### 1. Configure the backend
Docker Compose reads `backend/.env`, so create it before starting anything:

```bash
cp backend/.env.example backend/.env
```

Then set a real `JWT_SECRET_KEY` in `backend/.env`. The API refuses to start if it is missing, still the example value, or shorter than 32 characters:

```bash
openssl rand -hex 32
```

All other values are optional for a first run; see [Configuration](#configuration).

### 2. Start Postgres and the API
```bash
docker compose up -d --build
```

- API: http://localhost:8000 (interactive docs at `/docs`)
- Health check: http://localhost:8000/health/db
- Postgres is exposed on host port **5441** (not 5432, to avoid clashing with a local install)
- The first start runs every file in `backend/migrations/` automatically. Your local `backend/app/` is mounted into the container and Uvicorn runs with `--reload`, so code edits apply immediately. Only `requirements.txt` changes need `--build`.

### 3. Seed demo data
```bash
docker compose exec backend python scripts/seed_db.py
```

Or, from your own Python environment with `backend/.env` pointing at `localhost:5441`: `cd backend && python scripts/seed_db.py`.

### 4. Start the frontend
```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173.

### Demo accounts
All seeded accounts are pre-verified, so they work without email configured.

| Role | Login | Password | Notes |
|---|---|---|---|
| Passenger | `suhaas@example.com` | `password123` | also `mounish@example.com` |
| Driver | `chanakya@example.com` | `password123` | Sedan |
| Driver | `ramesh@example.com` | `password123` | Hatchback |
| Driver | `priya@example.com` | `password123` | SUV |
| Admin | `admin` | `admin123` | choose the Admin tab on the login page |

The three drivers are seeded online around Kottayam, each with a vehicle, and 12 tourist attractions are loaded for the tour guide.

### Try it end to end
1. Log in as the passenger, click a pickup and a drop point on the map, check the fare estimate, and request a ride. It is matched to the nearest suitable seeded driver.
2. In a **private window or second browser** (the session is stored per browser, so two roles can't share one window), log in as the matched driver. Accept the trip, then Start and Complete it.
3. Back as the passenger, pay for the trip (optionally redeeming reward points) and rate the driver.
4. Log in as the admin to see revenue, trips and driver stats update.
5. Try **Rent a driver** (add a vehicle first), the **Tour guide** page, and **Safety** (add an emergency contact with an email address, then use SOS during an active trip).

### Running the backend without Docker
Keep Postgres in Docker and run Uvicorn natively:

```bash
docker compose up -d db
cd backend
python3.12 -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                      # set JWT_SECRET_KEY
uvicorn app.main:app --reload
```

`make install`, `make run`, `make seed` and `make migrate FILE=...` wrap these steps on macOS/Linux. See [`backend/README.md`](./backend/README.md) for Windows notes and the `bcrypt` version pin.

## Configuration

**`backend/.env`**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Host-side default is `postgresql://postgres:postgres@localhost:5441/smart_cab_db`. Inside Docker, Compose overrides this to `db:5432`. |
| `JWT_SECRET_KEY` | yes | At least 32 characters and not the example value, or the API will not start. |
| `JWT_ALGORITHM` | no | Default `HS256`. |
| `JWT_EXPIRE_MINUTES` | no | Login token lifetime. Default `1440` (24 h). |
| `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` | for email | Gmail account and its 16-character App Password. Needed for sign-up verification, password reset and SOS emails. |
| `FRONTEND_URL` | no | Used to build links in emails. Default `http://localhost:5173`. |
| `EMAIL_VERIFICATION_EXPIRE_MINUTES`, `PASSWORD_RESET_EXPIRE_MINUTES` | no | Currently only change the expiry wording shown in the email. The actual link lifetimes are fixed at 60 and 30 minutes in `routers/auth.py`. |
| `GROQ_API_KEY` | for AI planner | API key from the Groq console. Without it the planner runs in an offline mode that returns two nearby attractions instead of an AI itinerary. |

**`frontend/.env`**: `VITE_API_URL` is the backend base URL (default `http://localhost:8000`).

### Setting up Gmail
1. Use a Gmail account with 2-Step Verification enabled.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. Put the address in `GMAIL_ADDRESS` and the 16-character password in `GMAIL_APP_PASSWORD`. This is not your normal Gmail password.

Without Gmail configured, registering a new passenger or driver returns an error and leaves an unverified account that cannot log in. Use the seeded accounts, or configure Gmail.

## How It Works

### Trip lifecycle
`REQUESTED` → `ACCEPTED` → `ONGOING` → `COMPLETED`, or `CANCELLED`.

- **Matching:** the nearest driver who is available, active, verified and has a location. For rides and tours the driver must also have a registered vehicle, and one matching the requested type is preferred, falling back to any type. For driver rental, any available driver is matched since the passenger supplies the car. If a driver declines, the trip is re-matched to someone else.
- **Cancelling:** passengers can cancel while a trip is `REQUESTED` or `ACCEPTED`. Three or more cancellations in a user's last ten trips sets a `is_flagged` fraud flag for admin review.
- **After completion:** the passenger pays, which awards reward points and a driver incentive, and can then leave a 1 to 5 star rating. The driver's average rating is recalculated on every new rating.
- Dashboards refresh by polling: every 8 s for drivers, every 8 s for passengers while a trip is active, and every 15 s for admins.

### Pricing
Implemented in [`backend/app/pricing.py`](./backend/app/pricing.py); every constant is exposed at module level. The fare estimate and the booking share one pricing path. If the matched driver's vehicle type differs from the one requested (or no type was requested), the booking is re-priced for the vehicle actually assigned, so the final fare can differ from the estimate.

| | Hatchback | Sedan | SUV |
|---|---|---|---|
| Base fare (includes first 3 km) | ₹84 | ₹93 | ₹102 |
| Per km beyond 3 km | ₹28 | ₹31 | ₹34 |
| Per minute beyond ~6 min | ₹1.00 | ₹1.25 | ₹1.50 |

- **Distance** is straight-line (Haversine) distance multiplied by 1.2 to approximate roads. Travel time is estimated at 30 km/h. There is no real routing.
- **Fare** = base + extra km + extra minutes (never below the base fare), × night × peak × surge. **Tours** add a flat ₹150 guide fee.
- **Night** (22:00 to 06:00 IST) ×1.15. **Peak** (weekdays 08:00 to 11:00 and 17:00 to 21:00 IST) ×1.10. Night and peak together are capped at ×1.30.
- **Surge** is local: pending requests versus available drivers within 5 km of the pickup, weighted by distance and request age, smoothed over time and capped at ×2.00. The combined time and surge multiplier never exceeds ×2.00.
- **Driver rental:** ₹50 base + ₹150 per hour, 2-hour minimum, with night and peak multipliers and surge capped at ×1.50.
- **Rewards:** 10 points per paid trip; 1 point = ₹1; points can cover at most 50% of a fare.

### Authentication
- Separate endpoints per role (`/auth/user/*`, `/auth/driver/*`, `/auth/admin/*`). The JWT carries the role, so a passenger token is rejected on driver and admin routes.
- Passengers and drivers must verify their email before logging in. Password-reset links are single-use (they stop working once the password changes).
- Admin accounts have no email. Only an existing admin can create another admin; the first one comes from the seed script.
- To call protected endpoints from `/docs`, click **Authorize** and paste the `access_token` from the matching login call.

## API Overview

Full, interactive reference at http://localhost:8000/docs.

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/{user,driver}/register`, `/login`, `/forgot-password`, `/reset-password`; `GET /auth/{user,driver}/verify-email`; `POST /auth/admin/login`, `/auth/admin/register` | public (admin register needs an admin token) |
| Profile | `GET/PATCH /auth/user/me`, `PATCH /auth/driver/me`, `POST /auth/{user,driver}/me/password` | logged in |
| Trips (passenger) | `POST /trips/estimate`, `POST /trips`, `/trips/tour`, `/trips/rental`; `GET /trips/my`, `/trips/{id}`; `PATCH /trips/{id}/cancel` | passenger |
| Trips (driver) | `GET /trips/driver/assigned`; `PATCH /trips/{id}/accept`, `/reject`, `/start`, `/complete` | driver |
| Drivers | `GET /drivers/me`, `/drivers/me/stats`, `/drivers/me/vehicle`; `PATCH /drivers/me/availability` | driver |
| My vehicles | `GET/POST /vehicles`, `DELETE /vehicles/{id}` | passenger |
| Payments | `POST /payments/{trip_id}`, `GET /payments/{trip_id}/receipt` | passenger |
| Feedback | `POST/GET /feedback/{trip_id}` | passenger |
| Rewards | `GET /rewards/me` | passenger |
| Emergency | `GET/POST /emergency/contacts`, `DELETE /emergency/contacts/{id}`, `POST /emergency/sos`, `GET /emergency/alerts/my` | passenger |
| Attractions | `GET /attractions` (filter by `city`, `category`, `near_lat`/`near_lng`/`radius_km`), `/attractions/categories`, `/attractions/nearby`; `POST /attractions/plan` | public |
| Admin | `GET /admin/{stats,users,drivers,trips,payments,alerts}`; `PATCH /admin/alerts/{id}/acknowledge`, `/admin/users/{id}/{active,flag}`, `/admin/drivers/{id}/{active,verify}`; `POST/DELETE /admin/attractions` | admin |
| Misc | `GET /`, `GET /health/db`, `GET /users/me` | `/users/me` needs a passenger token |

## Database

Thirteen tables: `users`, `drivers`, `vehicles` (a driver's own vehicle), `user_vehicles` (a passenger's own vehicle, for driver rental), `admins`, `attractions`, `trips`, `payments`, `feedback`, `emergency_contacts`, `safety_alerts`, `alert_notifications` and `reward_transactions`.

`trips.service_type` is `RIDE`, `TOUR` or `DRIVER_RENTAL`. Once a driver is assigned, a database check enforces that rides and tours reference the driver's `vehicle_id`, while rentals reference the passenger's `user_vehicle_id`. Unmatched trips may have neither.

### Migrations
There is no migration tool. Every schema change is a numbered SQL file in [`backend/migrations/`](./backend/migrations), applied in order:

| File | Change |
|---|---|
| `0001_initial_schema.sql` | Full base schema |
| `0002_relax_trip_vehicle_check.sql` | Vehicle check applies only once a driver is assigned |
| `0003_add_email_verification.sql` | `is_verified` on users and drivers |
| `0004_final_features.sql` | Surge and night tracking, reward redemption, suspend flags, cancellation reason, emergency contact email |
| `0005_pricing_peak.sql` | `peak_multiplier` on trips |

Docker Compose runs them automatically the first time the database volume is created. For an already-running database, apply a new one manually:

```bash
docker exec -i smart_cab_postgres psql -U postgres -d smart_cab_db < backend/migrations/000X_name.sql
```

To wipe everything and start fresh (this deletes local data, so re-seed afterwards):

```bash
docker compose down -v && docker compose up -d
```

`backend/app/models.py` is maintained by hand and must be kept in sync with the migrations. `db/smart_cab_db_schema.sql` is an early snapshot that predates driver rental and tours, so treat the migrations as the source of truth.

### Moving to Supabase
1. Create the project and run each file in `backend/migrations/`, in order, in the SQL Editor.
2. Copy the connection string from **Project Settings → Database**.
3. Set `DATABASE_URL` in `backend/.env`. No code changes are needed.

## Security Notes
- Passwords are hashed with bcrypt. `bcrypt` is pinned to `4.0.1` because newer releases break `passlib` 1.7.4.
- Login takes constant time whether or not the account exists, to prevent email enumeration.
- Rate limiting is in-memory and per IP, which is fine for a single process. Use a shared store (e.g. Redis) if you run multiple workers.
- Responses include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cache-Control: no-store`.
- CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173`. Update `allow_origins` in `backend/app/main.py` before deploying elsewhere.
- The frontend keeps its JWT in `localStorage`. httpOnly cookies would be stronger but need backend changes.
- Attraction browsing and the AI planner endpoint (`/attractions/*`) require no login.

## Known Limitations
- **Distance and ETA** are estimated from straight-line distance, not real routing or traffic.
- **No live tracking.** A driver's location is captured when they go online, not streamed, and there is no WebSocket layer. Dashboards poll instead.
- **Payments are mock.** There is no payment gateway; a payment is recorded as successful immediately.
- **Fraud detection** is a single rule (3+ cancellations in the last 10 trips), not ML.
- **Tour booking** requires a catalogue attraction. Spots from the live "near me" search or the AI planner that are not in the catalogue can be viewed and selected but cannot be booked yet.
- **First "near me" search is slow.** It makes 15 rate-limited Nominatim queries (about 1 per second) and caches the result for an hour.
- In-memory caches (surge smoothing, nearby attractions, rate limiter) are per process and reset on restart.
- There is no automated test suite yet.

