# Frontend — Smart Cab Booking System

React + Vite. Plain JavaScript for now (no TypeScript) to keep setup light.

## Structure
```
frontend/
├── src/
│   ├── api/
│   │   ├── client.js     # axios instance, reads VITE_API_URL
│   │   └── auth.js       # login/register/session helpers for the 3 roles
│   ├── pages/
│   │   ├── Login.jsx     # role-tabbed login (Passenger/Driver/Admin)
│   │   └── Register.jsx  # role-tabbed registration, fields adjust per role
│   ├── App.jsx            # react-router-dom routes: /login, /register
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── .env.example
```

## Setup
```bash
cd frontend
npm install
cp .env.example .env    # points at the backend, defaults to localhost:8000
npm run dev
```
Opens at `http://localhost:5173`.

Make sure the backend is running first (`docker compose up -d` from the
project root) — the backend also needs CORS configured to allow
`localhost:5173`, which is already set up in `backend/app/main.py`.

## Testing login
1. Seed test accounts on the backend: `cd backend && python scripts/seed_db.py`
   (all seeded accounts use password `password123`)
2. Open `http://localhost:5173/login`
3. Pick a role tab, log in with a seeded account
   (e.g. Passenger: `suhaas@example.com` / `password123`)
4. On success, the page shows the token and calls `/users/me` to prove
   the token actually authenticates against the backend

## Testing registration
1. Open `http://localhost:5173/register` (or click "Sign up" from the login page)
2. Pick a role tab — fields adjust per role (Admin just needs username/password;
   User/Driver need name/email/phone; Driver additionally needs a license number)
3. Submit — on success you're prompted to go log in with the new account
4. Verify the row landed in the DB: `docker exec -it smart_cab_postgres psql -U postgres -d smart_cab_db`
   then `SELECT * FROM users;` (or `drivers` / `admins`)

## Session storage
The JWT is stored in `localStorage` (`scb_token`, `scb_role`) after
login. This is fine for a project at this scope — if you want to
harden it later, httpOnly cookies are the more secure alternative,
but require backend changes too.

## Next steps
- Passenger/Driver/Admin dashboards, each their own route, gated by
  `getSession().role` (redirect to `/login` if missing or wrong role).
- Booking flow UI once the backend `/trips` endpoints exist.