import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, clearSession } from "../api/auth";
import { getMyDriverProfile, setAvailability } from "../api/drivers";
import {
  getDriverAssignedTrips,
  acceptTrip,
  startTrip,
  completeTrip,
} from "../api/trips";

const STATUS_LABELS = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Which action button to show for a given trip status, and what it does
const NEXT_ACTION = {
  REQUESTED: { label: "Accept", fn: acceptTrip },
  ACCEPTED: { label: "Start trip", fn: startTrip },
  ONGOING: { label: "Complete trip", fn: completeTrip },
};

export default function DriverDashboard() {
  const navigate = useNavigate();
  const session = getSession();

  const [profile, setProfile] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actingOnTripId, setActingOnTripId] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const data = await getMyDriverProfile(session.token);
      setProfile(data);
    } catch {
      clearSession();
      navigate("/login");
    }
  }, [session.token, navigate]);

  const loadTrips = useCallback(async () => {
    try {
      const data = await getDriverAssignedTrips(session.token);
      setTrips(data);
    } catch {
      // trip history is secondary -- don't block the page on this failing
    } finally {
      setLoadingTrips(false);
    }
  }, [session.token]);

  useEffect(() => {
    loadProfile();
    loadTrips();
  }, [loadProfile, loadTrips]);

  function getBrowserLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), // permission denied or unavailable -- fall back gracefully
        { timeout: 5000 }
      );
    });
  }

  async function handleToggleAvailability() {
    setAvailabilityError("");
    setTogglingAvailability(true);
    try {
      const goingOnline = !profile.availability_status;
      // Refresh location when going online, so matching has somewhere to work with.
      const location = goingOnline ? await getBrowserLocation() : null;
      const updated = await setAvailability(session.token, goingOnline, location);
      setProfile(updated);
      if (goingOnline && !location) {
        setAvailabilityError(
          "You're online, but location access wasn't granted — you won't be matched with " +
          "any ride requests until location is available. Toggle offline, then online again, " +
          "and allow location access when prompted."
        );
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setAvailabilityError(detail || "Could not update availability.");
    } finally {
      setTogglingAvailability(false);
    }
  }

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  async function handleTripAction(trip) {
    const action = NEXT_ACTION[trip.trip_status];
    if (!action) return;

    setActionError("");
    setActingOnTripId(trip.trip_id);
    try {
      await action.fn(session.token, trip.trip_id);
      await loadTrips();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setActionError(detail || "Could not update this trip.");
    } finally {
      setActingOnTripId(null);
    }
  }

  const activeTrips = trips.filter((t) => ["REQUESTED", "ACCEPTED", "ONGOING"].includes(t.trip_status));
  const pastTrips = trips.filter((t) => ["COMPLETED", "CANCELLED"].includes(t.trip_status));

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-mark">SC</div>
          <div className="brand-name">Smart Cab Booking</div>
        </div>
        <div className="header-right">
          {profile && <span className="header-user">{profile.name}</span>}
          <button className="logout-btn-small" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="card">
          <h2 className="card-title">Availability</h2>
          {availabilityError && <div className="error-msg">{availabilityError}</div>}
          {profile && (
            <div className="availability-row">
              <div>
                <div className="availability-status">
                  {profile.availability_status ? "You're online" : "You're offline"}
                </div>
                <div className="availability-hint">
                  {profile.availability_status
                    ? "You can be matched with nearby ride requests."
                    : "Go online to start receiving ride requests."}
                </div>
                {profile.availability_status && (profile.current_lat == null || profile.current_lng == null) && (
                  <div className="availability-hint availability-hint-warning">
                    No location on file — you won't be matched until you toggle off and on again with location access allowed.
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`availability-toggle ${profile.availability_status ? "on" : "off"}`}
                onClick={handleToggleAvailability}
                disabled={togglingAvailability}
              >
                <span className="availability-toggle-knob" />
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Active trips</h2>
          {actionError && <div className="error-msg">{actionError}</div>}
          {loadingTrips ? (
            <p className="empty-state">Loading...</p>
          ) : activeTrips.length === 0 ? (
            <p className="empty-state">
              No active trips right now. {profile && !profile.availability_status && "Go online to start receiving requests."}
            </p>
          ) : (
            <div className="trip-list">
              {activeTrips.map((trip) => (
                <DriverTripItem
                  key={trip.trip_id}
                  trip={trip}
                  onAction={handleTripAction}
                  acting={actingOnTripId === trip.trip_id}
                />
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Past trips</h2>
          {pastTrips.length === 0 ? (
            <p className="empty-state">No completed or cancelled trips yet.</p>
          ) : (
            <div className="trip-list">
              {pastTrips.map((trip) => (
                <DriverTripItem key={trip.trip_id} trip={trip} onAction={handleTripAction} acting={false} readOnly />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function DriverTripItem({ trip, onAction, acting, readOnly }) {
  const action = NEXT_ACTION[trip.trip_status];
  return (
    <div className="trip-list-item">
      <div>
        <div className="trip-list-route">
          {trip.pickup_location} &rarr; {trip.drop_location}
        </div>
        <div className="trip-list-meta">
          {new Date(trip.created_at).toLocaleString()} &middot;{" "}
          {trip.fare != null ? `\u20b9${trip.fare}` : "—"}
          {trip.distance_km != null && ` \u00b7 ${trip.distance_km} km`}
        </div>
      </div>
      <div className="trip-list-actions">
        <StatusBadge status={trip.trip_status} />
        {!readOnly && action && (
          <button
            className="trip-action-btn"
            onClick={() => onAction(trip)}
            disabled={acting}
          >
            {acting ? "Updating..." : action.label}
          </button>
        )}
      </div>
    </div>
  );
}