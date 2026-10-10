# Frontend: Smart Cab Booking System

React 18 + Vite 5. Plain JavaScript (no TypeScript) to keep setup light. For the project overview, see the [root README](../README.md); this file covers working on the frontend.

## Stack
React Router 6 for routing, Axios for API calls, Leaflet / react-leaflet for maps (OpenStreetMap tiles and Nominatim geocoding, no API key), and Motion for animation. There is a light and dark theme, remembered per browser.

## Structure
```
frontend/
├── src/
│   ├── api/                    # axios instance + one module per backend router
│   │   ├── client.js           # axios instance, base URL from VITE_API_URL
│   │   ├── auth.js             # login/register/session helpers for all 3 roles
│   │   ├── trips.js            # estimate, book ride/tour/rental, history, driver lifecycle actions
│   │   ├── drivers.js          # driver profile, stats, vehicle, availability toggle
│   │   ├── vehicles.js         # passenger's own vehicles
│   │   ├── payments.js         # pay and receipts
│   │   ├── feedback.js         # ratings
│   │   ├── rewards.js          # reward balance and history
│   │   ├── emergency.js        # emergency contacts, SOS, alert history
│   │   ├── attractions.js      # catalogue, nearby search, AI planner
│   │   └── admin.js            # admin dashboard calls
│   ├── components/
│   │   ├── ProtectedRoute.jsx  # redirects to /login unless the session role matches
│   │   ├── Navbar.jsx          # role-aware nav, theme toggle, profile menu, logout
│   │   ├── ProfileModal.jsx    # view/edit profile and change password
│   │   ├── MapPicker.jsx       # Leaflet click-or-search for pickup/drop, with geocoding
│   │   ├── PaymentModal.jsx    # payment mode, reward-point slider, receipt
│   │   ├── FeedbackModal.jsx   # 1-5 star rating and comment
│   │   ├── SOSButton.jsx       # confirm-then-send emergency alert with browser location
│   │   ├── EmergencyContacts.jsx
│   │   ├── TourChatbot.jsx     # floating AI tour planner (calls /attractions/plan)
│   │   ├── AuthShell.jsx       # shared layout for auth pages
│   │   ├── Segmented.jsx, StatusBadge.jsx, ServiceTypeBadge.jsx
│   │   └── motion.jsx          # shared animated primitives (Page, Card, Modal, Button, Counter, ...)
│   ├── pages/                  # one file per route (see below)
│   ├── theme/ThemeContext.jsx  # light/dark theme provider
│   ├── App.jsx                 # routes
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js              # dev server on port 5173
└── .env.example
```

## Routes

| Path | Page | Access |
|---|---|---|
| `/login` | Login (Passenger / Driver / Admin tabs; redirects to the matching home) | public |
| `/register` | Registration, with role-specific fields | public |
| `/verify-email` | Email verification landing page (from the emailed link) | public |
| `/forgot-password`, `/reset-password` | Password reset flow | public |
| `/dashboard` | Passenger dashboard: map booking for Ride and Rent a driver, active trip, history, pay and rate | passenger |
| `/tours` | Tour guide: catalogue, near me, AI planner, tour booking | passenger |
| `/rewards` | Points balance and activity | passenger |
| `/safety` | Emergency contacts and alert history | passenger |
| `/driver/dashboard` | Availability toggle, stats, active and past trips | driver |
| `/admin` | Overview, Users, Drivers, Trips, Payments, Alerts, Attractions tabs | admin |
| `/` | Redirects to `/login` | |

Anything else renders the not-found page.

## Setup
```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:8000
npm run dev
```
Opens at http://localhost:5173. Requires Node.js 18+.

Other scripts: `npm run build` (production build to `dist/`) and `npm run preview` (serve the build locally).

Start the backend first (`docker compose up -d --build` from the project root). CORS is configured for `localhost:5173` and `127.0.0.1:5173` in `backend/app/main.py`, so use one of those origins. If you change the frontend port or host, update `allow_origins` there too.

## Trying each flow
Seed demo data first: `cd backend && python scripts/seed_db.py` (or `docker compose exec backend python scripts/seed_db.py`). All seeded passengers and drivers use `password123`; the admin is `admin` / `admin123`.

**Passenger**
1. Log in as `suhaas@example.com`; you land on `/dashboard`.
2. Set a pickup (active by default), by searching (Nominatim autocomplete, e.g. "Kottayam railway station") or clicking the map. It then switches to the drop point; repeat.
3. A fare estimate appears once both points are set. Optionally choose a vehicle type, then request the ride. The trip appears with the matched driver, distance, fare and status.
4. Switch the toggle to **Rent a driver** to book an hourly driver for your own car (add a vehicle first; two-hour minimum).
5. While a trip is `Requested` or `Accepted` you can cancel it; during `Accepted` and `Ongoing` the SOS button is available.
6. After a trip is completed, **Pay** (optionally redeeming reward points), then **Rate**.

**Driver**
1. Log in as `chanakya@example.com`; you land on `/driver/dashboard`.
2. Toggle availability. Going online asks for browser location permission (allow it) and sends your coordinates, since a driver with no location is never matched.
3. Matched trips show under **Active trips**. The action button walks the lifecycle: **Accept** → **Start trip** → **Complete trip**. A requested trip can also be declined.
4. Finished trips move to **Past trips**.

To see both sides live, book a ride as a passenger in one window and log in as the matched driver in a **private window or second browser**. The session is stored per browser, so two roles can't share one window.

**Admin:** log in with the Admin tab (`admin` / `admin123`) to see stats, suspend or verify accounts, acknowledge SOS alerts and manage attractions. The dashboard refreshes every 15 seconds.

**Registration:** open `/register` and pick a role. Admin needs a username and password; passengers and drivers need name, email, phone and password, and drivers also need a licence number and vehicle details. New passenger and driver accounts need the email verification link before they can log in, which requires Gmail to be configured on the backend (see the [root README](../README.md#setting-up-gmail)).

## Session storage
After login the JWT and role are kept in `localStorage` (`scb_token`, `scb_role`), and the theme in `scb_theme`. This is fine for a project at this scope; httpOnly cookies would be more secure but need backend changes too. Passenger and driver dashboards poll the API every 8 seconds (the passenger dashboard only while a trip is active).

## Notes on the map picker
`MapPicker` uses OpenStreetMap tiles and Nominatim's free geocoding for both directions: typing a place name (forward search, debounced) and clicking the map (reverse geocoding). The map is centred on Kottayam, and search results are biased toward that area via a viewbox without being restricted to it, matching the seeded driver locations. Nominatim has a light rate limit (roughly one request per second) meant for low-volume, non-commercial use, which is fine for a class project but not for rapid automated requests.

The tour guide's "near me" uses browser geolocation and falls back to a default point near Kottayam if permission is denied or the lookup takes more than about 2.5 seconds.

## Known limitations
- Booking a tour needs a catalogue attraction. Spots from the live "near me" search or the AI planner that aren't in the catalogue can be selected, but booking them fails because the backend requires an `attraction_id`.
- The payment modal's pre-payment summary shows the night rate as "×1.25", while the backend currently applies ×1.15. The amount charged is always the backend's fare.
- `AdminDashboard` fetches the public attraction list with a raw `fetch` and a `localhost:8000` fallback instead of the shared axios client, so keep `VITE_API_URL` set if the backend isn't on that address.
- There is no automated test suite yet.