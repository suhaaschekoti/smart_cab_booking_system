import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { getSession, clearSession } from "../api/auth";
import { getMyDriverProfile, getMyDriverStats, setAvailability } from "../api/drivers";
import { getDriverAssignedTrips, acceptTrip, rejectTrip, startTrip, completeTrip } from "../api/trips";
import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import ServiceTypeBadge from "../components/ServiceTypeBadge";
import { Page, Card, Reveal, Counter, Row } from "../components/motion";

const NEXT = { REQUESTED: { label: "Accept", fn: acceptTrip }, ACCEPTED: { label: "Start trip", fn: startTrip }, ONGOING: { label: "Complete trip", fn: completeTrip } };
const getLocation = () => new Promise((r) => { if (!navigator.geolocation) return r(null); navigator.geolocation.getCurrentPosition((p) => r({ lat: p.coords.latitude, lng: p.coords.longitude }), () => r(null), { timeout: 5000 }); });

export default function DriverDashboard() {
  const navigate = useNavigate(); const session = getSession();
  const [profile, setProfile] = useState(null); const [stats, setStats] = useState(null);
  const [toggling, setToggling] = useState(false); const [availError, setAvailError] = useState("");
  const [trips, setTrips] = useState([]); const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(""); const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    try { const [p, s, t] = await Promise.all([getMyDriverProfile(session.token), getMyDriverStats(session.token), getDriverAssignedTrips(session.token)]); setProfile(p); setStats(s); setTrips(t); }
    catch { clearSession(); navigate("/login"); } finally { setLoading(false); }
  }, [session.token, navigate]);
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [load]);

  async function toggle() {
    setAvailError(""); setToggling(true);
    try { const on = !profile.availability_status; const loc = on ? await getLocation() : null; setProfile(await setAvailability(session.token, on, loc)); if (on && !loc) setAvailError("You're online, but location access wasn't granted. Toggle off and on again and allow location so riders can find you."); }
    catch (err) { setAvailError(err?.response?.data?.detail || "Could not update availability."); } finally { setToggling(false); }
  }
  async function act(trip, fn) { setActionError(""); setActing(trip.trip_id); try { await fn(session.token, trip.trip_id); await load(); } catch (err) { setActionError(err?.response?.data?.detail || "Could not update trip."); } finally { setActing(null); } }

  const active = trips.filter((t) => ["REQUESTED", "ACCEPTED", "ONGOING"].includes(t.trip_status));
  const past = trips.filter((t) => ["COMPLETED", "CANCELLED"].includes(t.trip_status));
  const noLoc = profile?.availability_status && (profile.current_lat == null || profile.current_lng == null);

  return (
    <div className="dashboard-shell">
      <Navbar role="driver" name={profile?.name} />
      <Page className="dashboard-content wide">
        {stats && (
          <Reveal className="stat-grid four">
            <div className="stat"><div className="stat-value"><Counter value={stats.completed_trips} /></div><div className="stat-label">Completed trips</div></div>
            <div className="stat"><div className="stat-value"><Counter value={stats.total_earnings} prefix="₹" /></div><div className="stat-label">Earnings</div></div>
            <div className="stat"><div className="stat-value">★ <Counter value={stats.rating} decimals={1} /></div><div className="stat-label">Rating</div></div>
            <div className="stat"><div className="stat-value"><Counter value={stats.incentive_score} /></div><div className="stat-label">Incentive score</div></div>
          </Reveal>
        )}

        <Card>
          {availError && <div className="error-msg">{availError}</div>}
          {profile && (
            <div className="availability-row">
              <div>
                <div className="availability-status">{profile.availability_status ? "You're online" : "You're offline"}</div>
                <div className="availability-hint">{profile.availability_status ? "Riders nearby can be matched with you." : "Go online to start receiving requests."}</div>
                {noLoc && <div className="availability-hint availability-hint-warning">No location on file. Toggle off and on again with location allowed.</div>}
                {!profile.is_verified && <div className="availability-hint availability-hint-warning">Your account isn't verified yet. Confirm your email or ask an admin.</div>}
              </div>
              <button className={`availability-toggle ${profile.availability_status ? "on" : "off"}`} onClick={toggle} disabled={toggling} aria-label="Toggle availability">
                <motion.span className="availability-toggle-knob" animate={{ x: profile.availability_status ? 22 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="card-title">Active trips</h2>
          {actionError && <div className="error-msg">{actionError}</div>}
          {loading ? <p className="empty-state">Loading…</p> : active.length === 0 ? <p className="empty-state">{profile?.availability_status ? "No requests right now. New trips appear here automatically." : "Go online to receive requests."}</p> : (
            <motion.div className="trip-list" layout><AnimatePresence initial={false}>{active.map((tr) => <TripRow key={tr.trip_id} trip={tr} acting={acting === tr.trip_id} onAction={act} />)}</AnimatePresence></motion.div>
          )}
        </Card>

        <Card>
          <h2 className="card-title">Past trips</h2>
          {past.length === 0 ? <p className="empty-state">Completed trips will show up here.</p> : <div className="trip-list">{past.map((tr) => <TripRow key={tr.trip_id} trip={tr} readOnly />)}</div>}
        </Card>
      </Page>
    </div>
  );
}

function TripRow({ trip, acting, onAction, readOnly }) {
  const next = NEXT[trip.trip_status];
  return (
    <Row className="trip-list-item">
      <div>
        <div className="trip-list-route"><ServiceTypeBadge type={trip.service_type} />{trip.pickup_location.split(",")[0]} → {trip.drop_location.split(",")[0]}</div>
        <div className="trip-list-meta">{trip.passenger_name && `${trip.passenger_name}, `}{new Date(trip.created_at).toLocaleString()}, ₹{trip.fare}{trip.distance_km != null && `, ${trip.distance_km} km`}{trip.duration_hours != null && `, ${trip.duration_hours} h`}{trip.service_type === "DRIVER_RENTAL" && <span className="tag-warn"> — you drive the passenger's car</span>}</div>
      </div>
      <div className="trip-list-actions">
        <StatusBadge status={trip.trip_status} />
        {!readOnly && next && <motion.button className="trip-action-btn" disabled={acting} onClick={() => onAction(trip, next.fn)} whileTap={{ scale: .96 }}>{acting ? "…" : next.label}</motion.button>}
        {!readOnly && trip.trip_status === "REQUESTED" && <button className="cancel-link" disabled={acting} onClick={() => onAction(trip, rejectTrip)}>Decline</button>}
      </div>
    </Row>
  );
}