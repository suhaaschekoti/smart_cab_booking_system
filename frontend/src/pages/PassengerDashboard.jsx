import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, clearSession, fetchCurrentUser } from "../api/auth";
import { requestTrip, getMyTrips, cancelTrip } from "../api/trips";
import MapPicker from "../components/MapPicker";

const STATUS_LABELS = {
  REQUESTED: "Requested",
  ACCEPTED: "Accepted",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const session = getSession();

  const [profile, setProfile] = useState(null);

  const [activePoint, setActivePoint] = useState("pickup");
  const [pickup, setPickup] = useState(null); // { lat, lng }
  const [drop, setDrop] = useState(null);
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");

  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [lastTrip, setLastTrip] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const loadTrips = useCallback(async () => {
    try {
      const data = await getMyTrips(session.token);
      setTrips(data);
    } catch {
      // silently ignore -- history is a nice-to-have, not blocking
    } finally {
      setLoadingTrips(false);
    }
  }, [session.token]);

  useEffect(() => {
    fetchCurrentUser(session.token)
      .then(setProfile)
      .catch(() => {
        clearSession();
        navigate("/login");
      });
    loadTrips();
  }, [session.token, navigate, loadTrips]);

  function handlePointSelected(point, { lat, lng, address }) {
    const fallbackLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (point === "pickup") {
      setPickup({ lat, lng });
      setPickupLocation(address || fallbackLabel);
      setActivePoint("drop"); // nudge the user to set the drop point next
    } else {
      setDrop({ lat, lng });
      setDropLocation(address || fallbackLabel);
    }
  }

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  function resetBookingForm() {
    setPickup(null);
    setDrop(null);
    setPickupLocation("");
    setDropLocation("");
    setActivePoint("pickup");
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();
    setBookingError("");

    if (!pickup || !drop) {
      setBookingError("Click the map to set both a pickup and a drop point.");
      return;
    }

    setBooking(true);
    try {
      const payload = {
        pickup_location: pickupLocation,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        drop_location: dropLocation,
        drop_lat: drop.lat,
        drop_lng: drop.lng,
      };
      const trip = await requestTrip(session.token, payload);
      setLastTrip(trip);
      resetBookingForm();
      loadTrips();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setBookingError(detail || "Could not create the trip. Check your inputs and try again.");
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(tripId) {
    try {
      await cancelTrip(session.token, tripId);
      loadTrips();
      if (lastTrip?.trip_id === tripId) {
        setLastTrip((t) => ({ ...t, trip_status: "CANCELLED" }));
      }
    } catch {
      // could surface an error toast here later
    }
  }

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
          <h2 className="card-title">Book a ride</h2>

          {bookingError && <div className="error-msg">{bookingError}</div>}

          <div className="point-toggle">
            <button
              type="button"
              className={`point-toggle-btn pickup ${activePoint === "pickup" ? "active" : ""}`}
              onClick={() => setActivePoint("pickup")}
            >
              <span className="point-dot pickup-dot" /> Set pickup
            </button>
            <button
              type="button"
              className={`point-toggle-btn drop ${activePoint === "drop" ? "active" : ""}`}
              onClick={() => setActivePoint("drop")}
            >
              <span className="point-dot drop-dot" /> Set drop
            </button>
          </div>

          <MapPicker
            activePoint={activePoint}
            pickup={pickup}
            drop={drop}
            onPointSelected={handlePointSelected}
          />

          <form onSubmit={handleBookingSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Pickup location</label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder='Click the map with "Set pickup" active'
                />
              </div>
              <div className="field">
                <label>Drop location</label>
                <input
                  type="text"
                  value={dropLocation}
                  onChange={(e) => setDropLocation(e.target.value)}
                  placeholder='Click the map with "Set drop" active'
                />
              </div>
            </div>
            <button className="submit-btn" type="submit" disabled={booking}>
              {booking ? "Booking..." : "Request ride"}
            </button>
          </form>
        </section>

        {lastTrip && (
          <section className="card">
            <h2 className="card-title">Latest trip</h2>
            <TripCard trip={lastTrip} onCancel={handleCancel} />
          </section>
        )}

        <section className="card">
          <h2 className="card-title">Trip history</h2>
          {loadingTrips ? (
            <p className="empty-state">Loading...</p>
          ) : trips.length === 0 ? (
            <p className="empty-state">No trips yet — book your first ride above.</p>
          ) : (
            <div className="trip-list">
              {trips.map((trip) => (
                <TripListItem key={trip.trip_id} trip={trip} onCancel={handleCancel} />
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

function TripCard({ trip, onCancel }) {
  return (
    <div className="trip-detail">
      <div className="trip-detail-row">
        <span>Status</span>
        <StatusBadge status={trip.trip_status} />
      </div>
      <div className="trip-detail-row">
        <span>Route</span>
        <span>{trip.pickup_location} &rarr; {trip.drop_location}</span>
      </div>
      <div className="trip-detail-row">
        <span>Distance</span>
        <span>{trip.distance_km != null ? `${trip.distance_km} km` : "—"}</span>
      </div>
      <div className="trip-detail-row">
        <span>Fare</span>
        <span>{trip.fare != null ? `\u20b9${trip.fare}` : "—"}</span>
      </div>
      <div className="trip-detail-row">
        <span>Driver</span>
        <span>{trip.driver_id ? `Driver #${trip.driver_id}` : "Not yet matched"}</span>
      </div>
      {(trip.trip_status === "REQUESTED" || trip.trip_status === "ACCEPTED") && (
        <button className="cancel-link" onClick={() => onCancel(trip.trip_id)}>
          Cancel this trip
        </button>
      )}
    </div>
  );
}

function TripListItem({ trip, onCancel }) {
  return (
    <div className="trip-list-item">
      <div>
        <div className="trip-list-route">
          {trip.pickup_location} &rarr; {trip.drop_location}
        </div>
        <div className="trip-list-meta">
          {new Date(trip.created_at).toLocaleString()} &middot;{" "}
          {trip.fare != null ? `\u20b9${trip.fare}` : "—"}
        </div>
      </div>
      <div className="trip-list-actions">
        <StatusBadge status={trip.trip_status} />
        {(trip.trip_status === "REQUESTED" || trip.trip_status === "ACCEPTED") && (
          <button className="cancel-link" onClick={() => onCancel(trip.trip_id)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}