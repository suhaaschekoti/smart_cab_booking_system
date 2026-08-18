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
│   ├── auth.py          # password hashing + JWT create/decode
│   └── routers/
│       └── auth.py      # register/login for all 3 roles
├── migrations/          # numbered SQL files, source of truth for the actual schema
├── scripts/
│   └── seed_db.py       # populates test data for local dev/demo (raw psycopg2, standalone script)
├── .env.example
├── Dockerfile
├── Makefile              # Unix/Mac only -- see Windows notes below
├── requirements.txt
└── start.sh
```

## Local Postgres port
Docker's Postgres is mapped to **host port 5441** (not the default 5432),
to avoid conflicting with any native Postgres install on your machine.
`backend/.env`'s `DATABASE_URL` should read:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5441/smart_cab_db
```
(This is the host-side value, used when running Python directly on your
machine. The backend container itself uses a different internal address
— `db:5432` — set directly in `docker-compose.yml`; you don't need to
touch that separately.)

## Setup (Docker — recommended day-to-day)
From the project root:
```bash
docker compose up -d
```
First time only, or after changing `requirements.txt`/`Dockerfile`, add `--build`.
Your local `backend/app/` is mounted into the container and uvicorn runs
with `--reload`, so code edits take effect immediately — no rebuild needed
for ordinary code changes.

## Setup (local dev, without Docker for the backend)
Useful if you'd rather run uvicorn natively. Keep Postgres in Docker either way:
```bash
docker compose up -d db
```
Then:
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # fill in JWT_SECRET_KEY etc.
uvicorn app.main:app --reload
```

**On Windows, `make` isn't available by default** — run the underlying
commands directly instead of `make install` / `make run` / `make seed`:
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
python scripts/seed_db.py
```

## Known gotcha: bcrypt version
`requirements.txt` pins `bcrypt==4.0.1` deliberately — newer bcrypt
releases (4.1+) break compatibility with `passlib` 1.7.4 (a missing
`__about__` attribute causes password hashing to fail with a confusing
"password cannot be longer than 72 bytes" error). Don't upgrade bcrypt
without also upgrading passlib and retesting.

## Seeding test data
```bash
python scripts/seed_db.py
```
(or `make seed` on Mac/Linux). All seeded accounts use password `password123`.

## Auth
Three separate roles, each with its own register/login endpoints and JWT:
- `POST /auth/user/register`, `POST /auth/user/login`
- `POST /auth/driver/register`, `POST /auth/driver/login`
- `POST /auth/admin/register`, `POST /auth/admin/login`

Each login returns a JWT (`access_token`) embedding the role, so a user's
token can't be used to call driver/admin-only routes. To protect a new
route, add the matching dependency:
```python

## Changing the schema
Two things need to stay in sync when you change the schema:
1. Add a new numbered file to `migrations/` (see `migrations/README.md`)
   — this is what actually runs against Postgres.
2. Update the matching class in `app/models.py` to reflect the change.

`models.py` is not auto-generated from the SQL files — keep them in sync
by hand, or consider adding Alembic later if this becomes error-prone.