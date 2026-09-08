# Frontend — Smart Cab Booking System

React + Vite. Plain JavaScript for now (no TypeScript) to keep setup light.

## Structure
```
frontend/
├── src/
│   ├── api/
│   │   ├── client.js     # axios instance, reads VITE_API_URL
│   │   ├── auth.js       # login/register/session helpers for the 3 roles
│   │   ├── trips.js       # booking, trip history, cancel, driver lifecycle actions
│   │   └── drivers.js     # driver profile + availability toggle
│   ├── components/
│   │   ├── ProtectedRoute.jsx  # redirects to /login unless session matches required role
│   │   └── MapPicker.jsx       # Leaflet click-or-search to set pickup/drop, with geocoding
│   ├── pages/
│   │   ├── Login.jsx             # role-tabbed login; redirects to the matching dashboard
│   │   ├── Register.jsx          # role-tabbed registration
│   │   ├── PassengerDashboard.jsx # booking form (map), active trip, trip history
│   │   └── DriverDashboard.jsx    # availability toggle, active/past trips with actions
│   ├── App.jsx            # react-router-dom routes
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
project root) — CORS is already configured for `localhost:5173` in
`backend/app/main.py`.

## Testing the passenger flow end-to-end
1. Seed test accounts: `cd backend && python scripts/seed_db.py`
   (all seeded accounts use password `password123`; seeded drivers are
   available, located near Kottayam, and have vehicles)
2. Open `http://localhost:5173/login`, log in as Passenger with
   `suhaas@example.com` / `password123` — you land on `/dashboard`
3. Book a ride using the map:
   - Click "Set pickup" (active by default)
   - Either type into the search box (autocomplete via OpenStreetMap
     Nominatim, e.g. "Kottayam railway station") and pick a result, OR
     click directly on the map
   - It auto-switches to "Set drop" — repeat for the drop point
   - Location names auto-fill from the search result or reverse
     geocoding; you can still edit them by hand
4. You should see the trip appear with a matched driver, computed
   distance and fare, and status `Requested`
5. Trip history below shows all past trips; `Cancel` is available
   while a trip is still `Requested` or `Accepted`

## Testing the driver flow end-to-end
1. Log in as Driver (`chanakya@example.com` / `password123`) — lands on `/driver/dashboard`
2. Toggle availability on/off — going online requests browser geolocation
   permission (allow it) and sends your current coordinates to the backend,
   so future bookings can match against your real location
3. Trips matched to you appear under "Active trips" with an action button
   that walks the lifecycle: **Accept** → **Start trip** → **Complete trip**
4. Completed/cancelled trips move to "Past trips" (read-only)
5. To see this working live: book a ride as a passenger in one browser
   tab/window while logged in as the matched driver in another — accept
   and progress the trip, then check the passenger's trip history updates

## Testing registration
1. Open `http://localhost:5173/register` (or click "Sign up" from the login page)
2. Pick a role tab — fields adjust per role (Admin just needs username/password;
   User/Driver need name/email/phone; Driver additionally needs a license number)
3. Submit — on success you're prompted to go log in with the new account

## Session storage
The JWT is stored in `localStorage` (`scb_token`, `scb_role`) after
login. This is fine for a project at this scope — if you want to
harden it later, httpOnly cookies are the more secure alternative,
but require backend changes too.

## Next steps
- Admin dashboard.
- Payments / feedback / emergency alerts (backend + frontend).

## Notes on the map picker
Uses OpenStreetMap tiles + Nominatim's free geocoding API (no API key,
no billing setup) for both directions: typing a place name (forward
search, debounced ~400ms) and clicking the map (reverse geocoding).
Search results are biased toward the Kottayam area (not restricted to
it) via a viewbox, matching the seeded driver locations. Nominatim has
a light rate limit (roughly 1 request/second) intended for exactly
this kind of low-volume, non-commercial use — fine for a class
project, but don't hammer it with rapid automated requests.