import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { getSession, clearSession, fetchCurrentUser } from "../api/auth";
import { requestTrip, requestRental, estimateFare, getMyTrips, cancelTrip } from "../api/trips";
import { getReceipt } from "../api/payments";
import { getFeedback } from "../api/feedback";
import { getMyVehicles, addVehicle } from "../api/vehicles";
import MapPicker from "../components/MapPicker";
import PaymentModal from "../components/PaymentModal";
import FeedbackModal from "../components/FeedbackModal";
import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import ServiceTypeBadge from "../components/ServiceTypeBadge";
import SOSButton from "../components/SOSButton";
import Segmented from "../components/Segmented";
import { Page, Card, Reveal, Button, Row } from "../components/motion";

const VT = ["Hatchback", "Sedan", "SUV"], FT = ["Petrol", "Diesel", "EV", "CNG"];
const ACTIVE = ["REQUESTED", "ACCEPTED", "ONGOING"];
const SERVICE = [{ key: "RIDE", label: "Ride" }, { key: "DRIVER_RENTAL", label: "Rent a driver" }];

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const session = getSession();
  const [profile, setProfile] = useState(null);
  const [serviceType, setServiceType] = useState("RIDE");
  const [activePoint, setActivePoint] = useState("pickup");
  const [pickup, setPickup] = useState(null); const [drop, setDrop] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(""); const [dropLocation, setDropLocation] = useState("");
  const [preferredType, setPreferredType] = useState(""); const [durationHours, setDurationHours] = useState(2);
  const [myVehicles, setMyVehicles] = useState([]); const [selectedVehicle, setSelectedVehicle] = useState("");
  const [vehForm, setVehForm] = useState({ vehicle_number: "", vehicle_type: "", fuel_type: "" }); const [showVehForm, setShowVehForm] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [booking, setBooking] = useState(false); const [bookingError, setBookingError] = useState("");
  const [trips, setTrips] = useState([]); const [loadingTrips, setLoadingTrips] = useState(true);
  const [payingTrip, setPayingTrip] = useState(null); const [paidIds, setPaidIds] = useState(new Set());
  const [feedbackTrip, setFeedbackTrip] = useState(null); const [ratedIds, setRatedIds] = useState(new Set());

  const loadTrips = useCallback(async () => {
    try {
      const data = await getMyTrips(session.token); setTrips(data);
      const completed = data.filter((t) => t.trip_status === "COMPLETED").map((t) => t.trip_id);
      const paid = new Set(), rated = new Set();
      await Promise.all(completed.map(async (id) => { try { await getReceipt(session.token, id); paid.add(id); } catch {} try { await getFeedback(session.token, id); rated.add(id); } catch {} }));
      setPaidIds(paid); setRatedIds(rated);
    } catch {} finally { setLoadingTrips(false); }
  }, [session.token]);
  const loadVehicles = useCallback(async () => { try { setMyVehicles(await getMyVehicles(session.token)); } catch {} }, [session.token]);

  useEffect(() => {
    fetchCurrentUser(session.token).then(setProfile).catch(() => { clearSession(); navigate("/login"); });
    loadTrips(); loadVehicles();
  }, [session.token, navigate, loadTrips, loadVehicles]);

  const activeTrip = trips.find((t) => ACTIVE.includes(t.trip_status));
  useEffect(() => { if (!activeTrip) return; const id = setInterval(loadTrips, 8000); return () => clearInterval(id); }, [activeTrip, loadTrips]);

  useEffect(() => {
    if (!pickup || (serviceType !== "DRIVER_RENTAL" && !drop)) return setEstimate(null);
    estimateFare(session.token, { service_type: serviceType, pickup_lat: pickup.lat, pickup_lng: pickup.lng, drop_lat: drop?.lat ?? null, drop_lng: drop?.lng ?? null, preferred_vehicle_type: preferredType || null, duration_hours: serviceType === "DRIVER_RENTAL" ? durationHours : null })
      .then(setEstimate).catch(() => setEstimate(null));
  }, [pickup, drop, serviceType, preferredType, durationHours, session.token]);

  function onPoint(point, { lat, lng, address }) {
    const fb = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (point === "pickup") { setPickup({ lat, lng }); setPickupLocation(address || fb); setActivePoint("drop"); } else { setDrop({ lat, lng }); setDropLocation(address || fb); }
  }
  function reset() { setPickup(null); setDrop(null); setPickupLocation(""); setDropLocation(""); setActivePoint("pickup"); setEstimate(null); }

  async function submitBooking(e) {
    e.preventDefault(); setBookingError("");
    if (!pickup || !drop) return setBookingError("Set both a pickup and a drop point on the map.");
    if (serviceType === "DRIVER_RENTAL" && !selectedVehicle) return setBookingError("Choose which of your vehicles the driver will drive.");
    setBooking(true);
    try {
      const base = { pickup_location: pickupLocation, pickup_lat: pickup.lat, pickup_lng: pickup.lng, drop_location: dropLocation, drop_lat: drop.lat, drop_lng: drop.lng };
      if (serviceType === "DRIVER_RENTAL") await requestRental(session.token, { ...base, user_vehicle_id: Number(selectedVehicle), duration_hours: durationHours });
      else await requestTrip(session.token, { ...base, preferred_vehicle_type: preferredType || null });
      reset(); loadTrips();
    } catch (err) { setBookingError(err?.response?.data?.detail || "Could not create the trip."); } finally { setBooking(false); }
  }
  async function cancel(id) { const reason = window.prompt("Reason for cancelling (optional):") ?? ""; try { await cancelTrip(session.token, id, reason); loadTrips(); } catch {} }
  async function saveVehicle() { try { const v = await addVehicle(session.token, { ...vehForm, vehicle_type: vehForm.vehicle_type || null, fuel_type: vehForm.fuel_type || null }); setVehForm({ vehicle_number: "", vehicle_type: "", fuel_type: "" }); setShowVehForm(false); await loadVehicles(); setSelectedVehicle(String(v.user_vehicle_id)); } catch {} }

  return (
    <div className="dashboard-shell">
      <AnimatePresence>{payingTrip && <PaymentModal key="pay" trip={payingTrip} token={session.token} onPaid={(p) => { setPaidIds((s) => new Set([...s, p.trip_id])); loadTrips(); }} onClose={() => setPayingTrip(null)} />}</AnimatePresence>
      <AnimatePresence>{feedbackTrip && <FeedbackModal key="fb" trip={feedbackTrip} token={session.token} onSubmitted={(f) => { setRatedIds((s) => new Set([...s, f.trip_id])); setFeedbackTrip(null); }} onClose={() => setFeedbackTrip(null)} />}</AnimatePresence>

      <Navbar role="user" name={profile?.name} extra={profile && <span className="points-chip">{profile.reward_points} pts</span>} />

      <Page className="dashboard-content wide">
        <AnimatePresence mode="wait" initial={false}>
          {activeTrip ? (
            <Card key="active" className="card-active">
              <div className="card-head"><h2 className="card-title">Your trip</h2><StatusBadge status={activeTrip.trip_status} /></div>
              <TripDetail trip={activeTrip} />
              <div className="trip-actions-row">
                {["ACCEPTED", "ONGOING"].includes(activeTrip.trip_status) && <SOSButton token={session.token} trip={activeTrip} />}
                {["REQUESTED", "ACCEPTED"].includes(activeTrip.trip_status) && <button className="cancel-link" onClick={() => cancel(activeTrip.trip_id)}>Cancel trip</button>}
              </div>
              {activeTrip.trip_status === "REQUESTED" && !activeTrip.driver_id && <p className="muted" style={{ marginTop: 12 }}>Finding a nearby driver…</p>}
            </Card>
          ) : (
            <motion.div key="book" className="booking-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Reveal className="booking-map">
                <div className="point-toggle">
                  <button type="button" className={`point-toggle-btn ${activePoint === "pickup" ? "active" : ""}`} onClick={() => setActivePoint("pickup")}><span className="point-dot pickup-dot" />Pickup</button>
                  <button type="button" className={`point-toggle-btn ${activePoint === "drop" ? "active" : ""}`} onClick={() => setActivePoint("drop")}><span className="point-dot drop-dot" />Drop</button>
                </div>
                <MapPicker activePoint={activePoint} pickup={pickup} drop={drop} onPointSelected={onPoint} />
              </Reveal>

              <Card>
                <h1 style={{ fontSize: 24, marginBottom: 14 }}>Where to?</h1>
                <Segmented options={SERVICE} value={serviceType} onChange={setServiceType} style={{ marginBottom: 16 }} />
                {serviceType === "DRIVER_RENTAL" && <p className="field-hint">A verified driver comes to you and drives your car. Billed hourly, two-hour minimum.</p>}
                {bookingError && <div className="error-msg">{bookingError}</div>}
                <form onSubmit={submitBooking}>
                  <div className="field"><label>Pickup</label><input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Tap the map or search" /></div>
                  <div className="field"><label>Drop</label><input value={dropLocation} onChange={(e) => setDropLocation(e.target.value)} placeholder="Tap the map or search" /></div>
                  {serviceType === "RIDE" && <div className="field"><label>Vehicle preference</label><select value={preferredType} onChange={(e) => setPreferredType(e.target.value)}><option value="">Any</option>{VT.map((t) => <option key={t}>{t}</option>)}</select></div>}
                  {serviceType === "DRIVER_RENTAL" && (<>
                    <div className="field"><label>Hours</label><input type="number" min="2" step="0.5" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} /></div>
                    <div className="field"><label>Your vehicle</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)} style={{ flex: 1 }}><option value="">Choose</option>{myVehicles.map((v) => <option key={v.user_vehicle_id} value={v.user_vehicle_id}>{v.vehicle_number}{v.vehicle_type && `, ${v.vehicle_type}`}</option>)}</select>
                        <button type="button" className="rate-btn" onClick={() => setShowVehForm((s) => !s)}>{showVehForm ? "Close" : "Add"}</button>
                      </div>
                    </div>
                    <AnimatePresence>{showVehForm && (
                      <motion.div className="inline-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                        <div className="field"><label>Vehicle number</label><input value={vehForm.vehicle_number} onChange={(e) => setVehForm({ ...vehForm, vehicle_number: e.target.value })} placeholder="KL-07-XX-1234" /></div>
                        <div className="form-grid"><div className="field" style={{ gridColumn: "span 1" }}><label>Type</label><select value={vehForm.vehicle_type} onChange={(e) => setVehForm({ ...vehForm, vehicle_type: e.target.value })}><option value="">Select</option>{VT.map((t) => <option key={t}>{t}</option>)}</select></div><div className="field" style={{ gridColumn: "span 1" }}><label>Fuel</label><select value={vehForm.fuel_type} onChange={(e) => setVehForm({ ...vehForm, fuel_type: e.target.value })}><option value="">Select</option>{FT.map((t) => <option key={t}>{t}</option>)}</select></div></div>
                        <button type="button" className="rate-btn" onClick={saveVehicle} disabled={!vehForm.vehicle_number}>Save vehicle</button>
                      </motion.div>)}</AnimatePresence>
                  </>)}
                  <AnimatePresence>{estimate && (
                    <motion.div className="estimate-box" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div className="estimate-main"><span>Estimated fare</span><strong>₹{Number(estimate.fare).toFixed(0)}</strong></div>
                      <div className="estimate-detail">
                        {estimate.distance_km != null && <span>{estimate.distance_km} km</span>}
                        {estimate.billed_hours != null && <span>{estimate.billed_hours} h billed</span>}
                        {Number(estimate.vehicle_type_multiplier) !== 1 && <span>vehicle ×{Number(estimate.vehicle_type_multiplier).toFixed(2)}</span>}
                        {estimate.night_surcharge && <span className="tag-warn">night rate</span>}
                        {Number(estimate.surge_multiplier) > 1 && <span className="tag-warn">surge ×{Number(estimate.surge_multiplier).toFixed(2)}</span>}
                      </div>
                    </motion.div>)}</AnimatePresence>
                  <Button className="btn-block" type="submit" disabled={booking || !pickup || !drop}>{booking ? "Requesting…" : serviceType === "DRIVER_RENTAL" ? "Request a driver" : "Request ride"}</Button>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <h2 className="card-title">Trip history</h2>
          {loadingTrips ? <p className="empty-state">Loading…</p> : trips.length === 0 ? <p className="empty-state">No trips yet. Your first ride will show up here.</p> : (
            <motion.div className="trip-list" layout>
              <AnimatePresence initial={false}>
                {trips.map((trip) => (
                  <Row key={trip.trip_id} className="trip-list-item">
                    <div>
                      <div className="trip-list-route"><ServiceTypeBadge type={trip.service_type} />{trip.pickup_location.split(",")[0]} → {trip.drop_location.split(",")[0]}</div>
                      <div className="trip-list-meta">{new Date(trip.created_at).toLocaleString()}, ₹{trip.fare}{trip.driver_name && `, ${trip.driver_name}`}</div>
                    </div>
                    <div className="trip-list-actions">
                      <StatusBadge status={trip.trip_status} />
                      {["REQUESTED", "ACCEPTED"].includes(trip.trip_status) && <button className="cancel-link" onClick={() => cancel(trip.trip_id)}>Cancel</button>}
                      {trip.trip_status === "COMPLETED" && !paidIds.has(trip.trip_id) && <button className="pay-btn" onClick={() => setPayingTrip(trip)}>Pay ₹{Number(trip.fare).toFixed(0)}</button>}
                      {trip.trip_status === "COMPLETED" && paidIds.has(trip.trip_id) && !ratedIds.has(trip.trip_id) && <button className="rate-btn" onClick={() => setFeedbackTrip(trip)}>Rate</button>}
                      {trip.trip_status === "COMPLETED" && paidIds.has(trip.trip_id) && ratedIds.has(trip.trip_id) && <span className="paid-badge">Paid and rated</span>}
                    </div>
                  </Row>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </Card>
      </Page>
    </div>
  );
}

function TripDetail({ trip }) {
  const R = ({ k, v }) => <div className="trip-detail-row"><span>{k}</span><span>{v}</span></div>;
  return (
    <div className="trip-detail">
      <R k="Type" v={<ServiceTypeBadge type={trip.service_type} />} />
      <R k="From" v={trip.pickup_location} /><R k="To" v={trip.drop_location} />
      {trip.distance_km != null && <R k="Distance" v={`${trip.distance_km} km`} />}
      {trip.duration_hours != null && <R k="Duration" v={`${trip.duration_hours} h`} />}
      <R k="Fare" v={`₹${trip.fare}`} />
      <R k="Driver" v={trip.driver_name ? <span>{trip.driver_name}{trip.driver_rating != null && <span className="muted"> · ★ {trip.driver_rating.toFixed(1)}</span>}{trip.driver_phone && <span className="muted"> · {trip.driver_phone}</span>}</span> : "Finding a driver"} />
    </div>
  );
}