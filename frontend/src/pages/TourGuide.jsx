import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, fetchCurrentUser } from "../api/auth";
import { getAttractions, getCategories } from "../api/attractions";
import { requestTour, estimateFare, getMyTrips } from "../api/trips";
import MapPicker from "../components/MapPicker";
import Navbar from "../components/Navbar";
import { motion, AnimatePresence } from "motion/react";
import { Page, Card, Button } from "../components/motion";

const CAT_ICON = { Nature: "🌿", Historical: "🏛️", Adventure: "🧗", Shopping: "🛍️", Culture: "🎭", Food: "🍛" };

export default function TourGuide() {
  const navigate = useNavigate();
  const session = getSession();
  const [profile, setProfile] = useState(null);
  const [attractions, setAttractions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [nearMe, setNearMe] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [pickupLocation, setPickupLocation] = useState("");
  const [preferredType, setPreferredType] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [hasActive, setHasActive] = useState(false);

  useEffect(() => {
    fetchCurrentUser(session.token).then(setProfile).catch(() => navigate("/login"));
    getCategories().then(setCategories).catch(() => {});
    getMyTrips(session.token).then((t) => setHasActive(t.some((x) => ["REQUESTED", "ACCEPTED", "ONGOING"].includes(x.trip_status)))).catch(() => {});
  }, [session.token, navigate]);

  useEffect(() => {
    const params = {}; if (category) params.category = category;
    if (nearMe) { params.near_lat = nearMe.lat; params.near_lng = nearMe.lng; params.radius_km = 60; }
    getAttractions(params).then(setAttractions).catch(() => {});
  }, [category, nearMe]);

  useEffect(() => {
    if (!selected || !pickup) return setEstimate(null);
    estimateFare(session.token, { service_type: "TOUR", pickup_lat: pickup.lat, pickup_lng: pickup.lng, drop_lat: selected.latitude, drop_lng: selected.longitude, preferred_vehicle_type: preferredType || null })
      .then(setEstimate).catch(() => setEstimate(null));
  }, [selected, pickup, preferredType, session.token]);

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((p) => setNearMe({ lat: p.coords.latitude, lng: p.coords.longitude }), () => alert("Location access denied."));
  }

  async function book() {
    setError(""); if (!pickup) return setError("Set your pickup point on the map.");
    setBooking(true);
    try { const t = await requestTour(session.token, { attraction_id: selected.attraction_id, pickup_location: pickupLocation, pickup_lat: pickup.lat, pickup_lng: pickup.lng, preferred_vehicle_type: preferredType || null }); setDone(t); }
    catch (err) { setError(err?.response?.data?.detail || "Could not book the tour."); }
    finally { setBooking(false); }
  }

  if (done) {
    return (
      <div className="dashboard-shell"><Navbar role="user" name={profile?.name} />
        <Page className="dashboard-content"><Card className="success-panel">
          <div className="success-icon">&#10003;</div>
          <h2 className="card-title" style={{ marginBottom: 6 }}>Tour booked!</h2>
          <p className="muted">{done.pickup_location.split(",")[0]} → {done.attraction_name}, ₹{done.fare}{done.driver_name && `, with ${done.driver_name}`}</p>
          <Button className="btn-block" style={{ marginTop: 20 }} onClick={() => navigate("/dashboard")}>Track on dashboard</Button>
        </Card></Page>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Navbar role="user" name={profile?.name} />
      <Page className="dashboard-content wide">
        <Card>
          <div className="card-head">
            <div><h1 style={{ fontSize: 24, marginBottom: 2 }}>Explore Kottayam</h1><p className="muted">Pick a place and we'll get you there. Guide fee included.</p></div>
            <button className="rate-btn" onClick={useMyLocation}>{nearMe ? "Near me ✓" : "Near me"}</button>
          </div>
          {hasActive && <div className="error-msg" style={{ marginTop: 12 }}>You already have an active trip — finish or cancel it before booking a tour.</div>}
          <div className="chip-row">
            <button className={`chip ${!category ? "active" : ""}`} onClick={() => setCategory("")}>All</button>
            {categories.map((c) => <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{CAT_ICON[c] || "📌"} {c}</button>)}
          </div>
          <div className="attraction-grid">
            {attractions.map((a) => (
              <motion.button layout whileTap={{ scale: .97 }} key={a.attraction_id} className={`attraction-card ${selected?.attraction_id === a.attraction_id ? "active" : ""}`} onClick={() => setSelected(a)} disabled={hasActive}>
                <div className="attraction-icon">{CAT_ICON[a.category] || "📌"}</div>
                <div className="attraction-name">{a.name}</div>
                <div className="attraction-meta">{a.city}, {a.category}</div>
                <div className="attraction-desc">{a.description}</div>
              </motion.button>
            ))}
            {attractions.length === 0 && <p className="empty-state">No attractions match this filter.</p>}
          </div>
        </Card>

        <AnimatePresence>{selected && !hasActive && (
          <Card key="book">
            <h2 className="card-title">Book a tour to {selected.name}</h2>
            {error && <div className="error-msg">{error}</div>}
            <p className="field-hint">Tap the map to set your pickup point.</p>
            <MapPicker activePoint="pickup" pickup={pickup} drop={{ lat: Number(selected.latitude), lng: Number(selected.longitude) }} onPointSelected={(_, { lat, lng, address }) => { setPickup({ lat, lng }); setPickupLocation(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }} />
            <div className="form-grid">
              <div className="field"><label>Pickup location</label><input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} /></div>
              <div className="field"><label>Preferred vehicle</label><select value={preferredType} onChange={(e) => setPreferredType(e.target.value)}><option value="">Any</option><option>Hatchback</option><option>Sedan</option><option>SUV</option></select></div>
            </div>
            {estimate && (
              <div className="estimate-box">
                <div className="estimate-main"><span>Estimated fare, includes ₹{Number(estimate.tour_guide_fee).toFixed(0)} guide fee</span><strong>₹{Number(estimate.fare).toFixed(0)}</strong></div>
                <div className="estimate-detail"><span>{estimate.distance_km} km</span>{estimate.night_surcharge && <span className="tag-warn">night rate</span>}{Number(estimate.surge_multiplier) > 1 && <span className="tag-warn">surge ×{Number(estimate.surge_multiplier).toFixed(2)}</span>}</div>
              </div>
            )}
            <Button className="btn-block" onClick={book} disabled={booking || !pickup}>{booking ? "Booking…" : "Book this tour"}</Button>
          </Card>
        )}</AnimatePresence>
      </Page>
    </div>
  );
}